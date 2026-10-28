package repository

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"omnimail/desktop/internal/domain"
)

var contentHash = regexp.MustCompile(`^[0-9a-f]{64}$`)

func (s *Store) contentPath(hash string) (string, error) {
	if !contentHash.MatchString(hash) {
		return "", domain.ErrProtocol
	}
	return filepath.Join(s.dataDir, "attachments", hash[:2], hash), nil
}

func (s *Store) SaveMailBody(ctx context.Context, id string, body domain.DecodedMail) (err error) {
	if !domain.ValidAccountID(id) || len(body.Text) > 1<<20 || !utf8.ValidString(body.Text) || len(body.Attachments) > 128 {
		return domain.ErrTooLarge
	}
	s.blobMu.Lock()
	defer s.blobMu.Unlock()
	hashes := []string{}
	created := []string{}
	// DB 提交前的文件失败需要补偿；同进程的内容写入串行，避免误删另一笔尚未提交的共享文件。
	defer func() {
		if err != nil {
			cleanup, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			for _, hash := range created {
				err = errors.Join(err, s.removeUnusedContent(cleanup, hash))
			}
		}
	}()
	for _, attachment := range body.Attachments {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if len(attachment.Data) > 25<<20 || len(attachment.Filename) == 0 || len(attachment.Filename) > 256 ||
			!utf8.ValidString(attachment.Filename) || strings.ContainsFunc(attachment.Filename, unicode.IsControl) || len(attachment.MIME) > 128 {
			return domain.ErrTooLarge
		}
		if attachment.Hash != "" {
			path, err := s.contentPath(attachment.Hash)
			if err != nil || attachment.Size < 0 || attachment.Size > 25<<20 {
				return domain.ErrProtocol
			}
			if err := s.checkContent(path, attachment.Hash); err != nil {
				return err
			}
			hashes = append(hashes, attachment.Hash)
			continue
		}
		sum := sha256.Sum256(attachment.Data)
		hash := hex.EncodeToString(sum[:])
		added, writeError := s.writeContent(hash, attachment.Data)
		if writeError != nil {
			return writeError
		}
		hashes = append(hashes, hash)
		if added {
			created = append(created, hash)
		}
	}
	return s.saveBodyReferences(ctx, id, body, hashes)
}

func (s *Store) saveBodyReferences(ctx context.Context, id string, body domain.DecodedMail, hashes []string) (err error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return storageError("开始正文保存", err)
	}
	defer rollback(tx, &err)
	result, err := tx.ExecContext(ctx, "UPDATE mail_message SET body_text=? WHERE id=?", body.Text, id)
	if err != nil {
		return storageError("保存正文", err)
	}
	count, err := result.RowsAffected()
	if err != nil || count != 1 {
		return domain.ErrProtocol
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM mail_attachment WHERE mail_id=?", id); err != nil {
		return storageError("更新附件引用", err)
	}
	for i, attachment := range body.Attachments {
		size := int64(len(attachment.Data))
		if attachment.Hash != "" {
			size = attachment.Size
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO mail_attachment(id,mail_id,filename,mime,size_bytes,content_hash)
			VALUES(?,?,?,?,?,?)`, rand.Text(), id, attachment.Filename, attachment.MIME, size, hashes[i]); err != nil {
			return storageError("保存附件引用", err)
		}
	}
	return storageError("提交正文与附件", tx.Commit())
}

func (s *Store) writeContent(hash string, data []byte) (bool, error) {
	path, err := s.contentPath(hash)
	if err != nil {
		return false, err
	}
	if _, err := os.Stat(path); err == nil {
		return false, s.checkContent(path, hash)
	} else if !errors.Is(err, os.ErrNotExist) {
		return false, storageError("检查内容缓存", err)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return false, storageError("创建内容目录", err)
	}
	file, err := os.CreateTemp(filepath.Dir(path), ".incoming-")
	if err != nil {
		return false, storageError("创建下载临时文件", err)
	}
	temp := file.Name()
	_, writeError := file.Write(data)
	closeError := file.Close()
	if err := errors.Join(writeError, closeError); err != nil {
		return false, errors.Join(storageError("写入缓存", err), storageError("清理临时文件", os.Remove(temp)))
	}
	if err := os.Rename(temp, path); err != nil {
		removeError := os.Remove(temp)
		if check := s.checkContent(path, hash); check == nil {
			return false, storageError("清理重复缓存", removeError)
		}
		return false, errors.Join(storageError("提交缓存文件", err), storageError("清理临时文件", removeError))
	}
	return true, nil
}

func (s *Store) checkContent(path, hash string) (err error) {
	file, err := os.Open(path)
	if err != nil {
		return storageError("打开缓存", err)
	}
	defer func() { err = errors.Join(err, storageError("关闭缓存", file.Close())) }()
	digest := sha256.New()
	size, err := io.Copy(digest, io.LimitReader(file, (25<<20)+1))
	if err != nil || size > 25<<20 || hex.EncodeToString(digest.Sum(nil)) != hash {
		return domain.ErrProtocol
	}
	return nil
}

func (s *Store) removeUnusedContent(ctx context.Context, hash string) error {
	var count int
	if err := s.db.QueryRowContext(ctx, "SELECT count(*) FROM mail_attachment WHERE content_hash=?", hash).Scan(&count); err != nil {
		return storageError("检查失败下载引用", err)
	}
	if count != 0 {
		return nil
	}
	path, err := s.contentPath(hash)
	if err != nil {
		return err
	}
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return storageError("清理孤立下载", err)
	}
	return nil
}

func (s *Store) ReadAttachment(ctx context.Context, id string) (data []byte, name string, err error) {
	if !domain.ValidAccountID(id) {
		return nil, "", domain.ErrProtocol
	}
	var hash string
	if err := s.db.QueryRowContext(ctx, "SELECT content_hash,filename FROM mail_attachment WHERE id=?", id).Scan(&hash, &name); err != nil {
		return nil, "", storageError("读取附件位置", err)
	}
	path, err := s.contentPath(hash)
	if err != nil {
		return nil, "", err
	}
	file, err := os.Open(path)
	if err != nil {
		return nil, "", storageError("打开附件缓存", err)
	}
	defer func() { err = errors.Join(err, storageError("关闭附件缓存", file.Close())) }()
	data, err = io.ReadAll(io.LimitReader(file, (25<<20)+1))
	if err != nil {
		return nil, "", storageError("读取附件缓存", err)
	}
	digest := sha256.Sum256(data)
	if len(data) > 25<<20 || hex.EncodeToString(digest[:]) != hash {
		return nil, "", domain.ErrProtocol
	}
	return data, name, nil
}
