package storage

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/klauspost/compress/zstd"
)

// BlobStore 管理当前本地空间的 CAS 内容寻址存储（原始 .eml.zst 与去重附件）。
type BlobStore struct {
	profileDir string
}

func NewBlobStore(profileDir string) *BlobStore {
	return &BlobStore{profileDir: profileDir}
}

func (b *BlobStore) RawDir() string {
	return filepath.Join(b.profileDir, "blobs", "raw")
}

func (b *BlobStore) AttachmentsDir() string {
	return filepath.Join(b.profileDir, "blobs", "attachments")
}

func isValidHexHash(h string) bool {
	if len(h) != 64 {
		return false
	}
	for i := 0; i < len(h); i++ {
		c := h[i]
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			return false
		}
	}
	return true
}

func (b *BlobStore) RawPath(shaHex string) (string, error) {
	norm := strings.ToLower(strings.TrimSpace(shaHex))
	if !isValidHexHash(norm) {
		return "", errors.New("无效的原始邮件 SHA-256 哈希")
	}
	return filepath.Join(b.RawDir(), norm[:2], norm+".eml.zst"), nil
}

func (b *BlobStore) AttachmentPath(shaHex string) (string, error) {
	norm := strings.ToLower(strings.TrimSpace(shaHex))
	if !isValidHexHash(norm) {
		return "", errors.New("无效的附件 SHA-256 哈希")
	}
	return filepath.Join(b.AttachmentsDir(), norm[:2], norm), nil
}

// PutRawEML 计算原始 RFC5322 字节的 SHA-256 并使用 Zstd 压缩落盘。
func (b *BlobStore) PutRawEML(raw []byte) (string, error) {
	sum := sha256.Sum256(raw)
	shaHex := hex.EncodeToString(sum[:])
	target, err := b.RawPath(shaHex)
	if err != nil {
		return "", err
	}
	if _, err := os.Stat(target); err == nil {
		return shaHex, nil
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o700); err != nil {
		return "", err
	}
	enc, err := zstd.NewWriter(nil, zstd.WithEncoderLevel(zstd.SpeedDefault))
	if err != nil {
		return "", err
	}
	compressed := enc.EncodeAll(raw, make([]byte, 0, len(raw)/2+64))
	_ = enc.Close()

	tmp := target + ".tmp"
	if err := os.WriteFile(tmp, compressed, 0o600); err != nil {
		return "", err
	}
	if err := os.Rename(tmp, target); err != nil {
		_ = os.Remove(tmp)
		return "", err
	}
	return shaHex, nil
}

// GetRawEML 流式解压并返回原始 RFC5322 字节流。
func (b *BlobStore) GetRawEML(shaHex string) ([]byte, error) {
	target, err := b.RawPath(shaHex)
	if err != nil {
		return nil, err
	}
	compressed, err := os.ReadFile(target)
	if err != nil {
		return nil, err
	}
	dec, err := zstd.NewReader(bytes.NewReader(compressed))
	if err != nil {
		return nil, err
	}
	defer dec.Close()
	return io.ReadAll(dec)
}

// PutAttachment 流式写入附件二进制内容并按 SHA-256 去重归档。
func (b *BlobStore) PutAttachment(r io.Reader) (shaHex string, size int64, dstPath string, err error) {
	if err := os.MkdirAll(b.AttachmentsDir(), 0o700); err != nil {
		return "", 0, "", err
	}
	tmpFile, err := os.CreateTemp(b.AttachmentsDir(), ".att-upload-*")
	if err != nil {
		return "", 0, "", err
	}
	tmpName := tmpFile.Name()
	hasher := sha256.New()
	written, copyErr := io.Copy(io.MultiWriter(tmpFile, hasher), r)
	closeErr := tmpFile.Close()
	if copyErr != nil || closeErr != nil {
		_ = os.Remove(tmpName)
		if copyErr != nil {
			return "", 0, "", copyErr
		}
		return "", 0, "", closeErr
	}
	shaHex = hex.EncodeToString(hasher.Sum(nil))
	dstPath, err = b.AttachmentPath(shaHex)
	if err != nil {
		_ = os.Remove(tmpName)
		return "", 0, "", err
	}
	if _, statErr := os.Stat(dstPath); statErr == nil {
		_ = os.Remove(tmpName)
		return shaHex, written, dstPath, nil
	}
	if err := os.MkdirAll(filepath.Dir(dstPath), 0o700); err != nil {
		_ = os.Remove(tmpName)
		return "", 0, "", err
	}
	if err := os.Rename(tmpName, dstPath); err != nil {
		_ = os.Remove(tmpName)
		return "", 0, "", err
	}
	return shaHex, written, dstPath, nil
}
