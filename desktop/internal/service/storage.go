package service

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type StorageUsage struct {
	TotalBytes       int64 `json:"totalBytes"`
	MailDataBytes    int64 `json:"mailDataBytes"`
	AttachmentsBytes int64 `json:"attachmentsBytes"`
	LogsBytes        int64 `json:"logsBytes"`
	BackupsBytes     int64 `json:"backupsBytes"`
	OtherBytes       int64 `json:"otherBytes"`
}

// Storage 只统计装配时指定的数据目录，不接受前端传入的路径。
type Storage struct{ dataDir string }

func NewStorage(dataDir string) *Storage { return &Storage{dataDir: dataDir} }

func (s *Storage) Usage(ctx context.Context) (StorageUsage, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := ctx.Err(); err != nil {
		return StorageUsage{}, err
	}
	if !filepath.IsAbs(s.dataDir) || filepath.Dir(filepath.Clean(s.dataDir)) == filepath.Clean(s.dataDir) {
		return StorageUsage{}, errors.New("存储统计目录无效")
	}
	root, err := os.OpenRoot(s.dataDir)
	if err != nil {
		return StorageUsage{}, errors.New("无法读取本机存储情况")
	}
	defer root.Close()
	var result StorageUsage
	entries := 0
	err = fs.WalkDir(root.FS(), ".", func(name string, entry fs.DirEntry, walkErr error) error {
		if err := ctx.Err(); err != nil {
			return err
		}
		entries++
		if entries > 100_000 {
			return errors.New("存储统计文件数量超过限制")
		}
		// 同步和日志轮转可能移走文件；忽略已消失项，其他读取错误必须报告，不能伪装成零占用。
		if errors.Is(walkErr, fs.ErrNotExist) && name != "." {
			return nil
		}
		if walkErr != nil {
			return walkErr
		}
		// 不跟随链接；os.Root 额外保证路径即使被并发替换也无法越出数据目录。
		if entry.IsDir() || !entry.Type().IsRegular() {
			return nil
		}
		return addStorageFile(root, name, &result)
	})
	if err != nil {
		if ctx.Err() != nil {
			return StorageUsage{}, ctx.Err()
		}
		return StorageUsage{}, errors.New("无法读取完整的本机存储情况，请重试")
	}
	return result, nil
}

func addStorageFile(root *os.Root, name string, result *StorageUsage) error {
	// Windows 目录枚举可能缓存仍在写入的 WAL 大小，单独读取文件元信息以得到当前值。
	info, err := root.Lstat(name)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() {
		return nil
	}
	size := info.Size()
	// IPC 使用 JavaScript number，防止溢出或精度损失。
	if size < 0 || size > (1<<53-1)-result.TotalBytes {
		return errors.New("存储统计大小超过限制")
	}
	result.TotalBytes += size
	switch {
	case name == "omnimail.db" || name == "omnimail.db-wal" || name == "omnimail.db-shm":
		result.MailDataBytes += size
	case strings.HasPrefix(name, "attachments/"):
		result.AttachmentsBytes += size
	case strings.HasPrefix(name, "logs/"):
		result.LogsBytes += size
	case strings.HasPrefix(name, "backups/"):
		result.BackupsBytes += size
	default:
		// 包括未来新增的缓存，不按扩展名猜测邮件或附件，避免误分类。
		result.OtherBytes += size
	}
	return nil
}
