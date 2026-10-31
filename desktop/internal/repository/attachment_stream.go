package repository

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"unicode"
	"unicode/utf8"

	"omnimail/desktop/internal/domain"
)

type contextReader struct {
	ctx    context.Context
	reader io.Reader
}

func (r contextReader) Read(buffer []byte) (int, error) {
	if r.ctx.Err() != nil {
		return 0, r.ctx.Err()
	}
	return r.reader.Read(buffer)
}

// CacheAttachment 在短锁内串行流式写文件，不持有 SQL 事务；租约保护其他尚未提交的相同内容。
func (s *Store) CacheAttachment(ctx context.Context, name, kind string, reader io.Reader) (domain.DecodedAttachment, error) {
	if len(name) == 0 || len(name) > 256 || !utf8.ValidString(name) || strings.ContainsFunc(name, unicode.IsControl) || len(kind) > 128 {
		return domain.DecodedAttachment{}, domain.ErrProtocol
	}
	s.blobMu.Lock()
	defer s.blobMu.Unlock()
	root := filepath.Join(s.dataDir, "attachments")
	if err := os.MkdirAll(root, 0o700); err != nil {
		return domain.DecodedAttachment{}, storageError("创建附件缓存", err)
	}
	file, err := os.CreateTemp(root, ".incoming-")
	if err != nil {
		return domain.DecodedAttachment{}, storageError("创建下载文件", err)
	}
	digest := sha256.New()
	size, copyError := io.Copy(io.MultiWriter(file, digest), io.LimitReader(contextReader{ctx, reader}, (25<<20)+1))
	closeError := file.Close()
	cleanup := func(cause error) error {
		return errors.Join(cause, storageError("清理下载临时文件", os.Remove(file.Name())))
	}
	if copyError != nil || closeError != nil {
		return domain.DecodedAttachment{}, cleanup(storageError("下载附件", errors.Join(copyError, closeError)))
	}
	if size > 25<<20 {
		return domain.DecodedAttachment{}, cleanup(domain.ErrTooLarge)
	}
	if ctx.Err() != nil {
		return domain.DecodedAttachment{}, cleanup(ctx.Err())
	}
	hash := hex.EncodeToString(digest.Sum(nil))
	path, err := s.contentPath(hash)
	if err != nil {
		return domain.DecodedAttachment{}, cleanup(err)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return domain.DecodedAttachment{}, cleanup(storageError("创建内容分桶", err))
	}
	if _, err := os.Stat(path); err == nil {
		if err := s.checkContent(path, hash); err != nil {
			return domain.DecodedAttachment{}, cleanup(err)
		}
		if err := os.Remove(file.Name()); err != nil {
			return domain.DecodedAttachment{}, storageError("回收重复下载", err)
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return domain.DecodedAttachment{}, cleanup(storageError("检查已有内容", err))
	} else if err := os.Rename(file.Name(), path); err != nil {
		return domain.DecodedAttachment{}, cleanup(storageError("提交下载文件", err))
	}
	s.staged[hash]++
	return domain.DecodedAttachment{Filename: name, MIME: kind, Hash: hash, Size: size}, nil
}

func (s *Store) ReleaseCachedAttachments(ctx context.Context, hashes []string) (err error) {
	s.blobMu.Lock()
	defer s.blobMu.Unlock()
	for _, hash := range hashes {
		if !contentHash.MatchString(hash) {
			err = errors.Join(err, domain.ErrProtocol)
			continue
		}
		if s.staged[hash] > 1 {
			s.staged[hash]--
			continue
		}
		delete(s.staged, hash)
		err = errors.Join(err, s.removeUnusedContent(ctx, hash))
	}
	return err
}
