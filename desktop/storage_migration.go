package main

import (
	"errors"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

type StorageInfo struct {
	BootstrapPath string `json:"bootstrapPath"`
	DataDir       string `json:"dataDir"`
	Initialized   bool   `json:"initialized"`
	UsedBytes     uint64 `json:"usedBytes"`
	FreeBytes     uint64 `json:"freeBytes"`
	TotalBytes    uint64 `json:"totalBytes"`
}

type TargetDirCheck struct {
	Valid           bool   `json:"valid"`
	NormalizedPath  string `json:"normalizedPath"`
	Writable        bool   `json:"writable"`
	FreeBytes       uint64 `json:"freeBytes"`
	RequiredBytes   uint64 `json:"requiredBytes"`
	SufficientSpace bool   `json:"sufficientSpace"`
	SameAsCurrent   bool   `json:"sameAsCurrent"`
	Message         string `json:"message"`
}

type MigrationResult struct {
	OldDataDir  string `json:"oldDataDir"`
	NewDataDir  string `json:"newDataDir"`
	CopiedFiles int    `json:"copiedFiles"`
	CopiedBytes uint64 `json:"copiedBytes"`
	KeptSource  bool   `json:"keptSource"`
}

func sameOrSubPath(base, candidate string) bool {
	rel, err := filepath.Rel(strings.ToLower(filepath.Clean(base)), strings.ToLower(filepath.Clean(candidate)))
	if err != nil {
		return false
	}
	return rel == "." || (!strings.HasPrefix(rel, "..") && rel != "")
}

func computeDirSize(root string) uint64 {
	var total uint64
	_ = filepath.WalkDir(root, func(_ string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if info, statErr := d.Info(); statErr == nil && info.Size() > 0 {
			total += uint64(info.Size())
		}
		return nil
	})
	return total
}

func probeDirWritable(dir string) bool {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return false
	}
	probe := filepath.Join(dir, ".omnimail-write-probe")
	if err := os.WriteFile(probe, []byte("ok"), 0o600); err != nil {
		return false
	}
	_ = os.Remove(probe)
	return true
}

func (s *DesktopStateStore) getStorageInfo() StorageInfo {
	boot := s.readBootstrap()
	_ = ensureDataLayout(boot.DataDir)
	used := computeDirSize(boot.DataDir)
	free, total := queryVolumeSpace(boot.DataDir)
	return StorageInfo{
		BootstrapPath: s.bootstrapFilePath(),
		DataDir:       boot.DataDir,
		Initialized:   boot.Initialized,
		UsedBytes:     used,
		FreeBytes:     free,
		TotalBytes:    total,
	}
}

func (s *DesktopStateStore) inspectTargetDir(rawTarget string) TargetDirCheck {
	trimmed := strings.TrimSpace(rawTarget)
	if trimmed == "" || len(trimmed) > 240 || !filepath.IsAbs(trimmed) {
		return TargetDirCheck{Message: "请输入有效的本地绝对目录路径（如 D:\\OmniMailData）"}
	}
	clean := filepath.Clean(trimmed)
	if filepath.Dir(clean) == clean {
		return TargetDirCheck{NormalizedPath: clean, Message: "请勿直接选择磁盘根目录，请指定独立子文件夹（如 D:\\OmniMailData）"}
	}
	if s.installDir != "" && sameOrSubPath(s.installDir, clean) {
		return TargetDirCheck{NormalizedPath: clean, Message: "数据目录不能位于程序安装目录内，避免覆盖升级冲突"}
	}

	current := s.getDataDir()
	if strings.EqualFold(clean, current) {
		free, _ := queryVolumeSpace(clean)
		return TargetDirCheck{
			Valid: true, NormalizedPath: clean, Writable: true,
			FreeBytes: free, SufficientSpace: true, SameAsCurrent: true,
			Message: "所选路径与当前数据目录相同",
		}
	}
	if sameOrSubPath(current, clean) || sameOrSubPath(clean, current) {
		return TargetDirCheck{NormalizedPath: clean, Message: "新旧数据目录不能互为父子目录，请选择独立文件夹"}
	}

	used := computeDirSize(current)
	required := used + 32*1024*1024
	writable := probeDirWritable(clean)
	free, _ := queryVolumeSpace(clean)
	sufficient := free == 0 || free >= required
	if !writable {
		return TargetDirCheck{NormalizedPath: clean, FreeBytes: free, RequiredBytes: required, Message: "目标目录无写入权限，请选择当前用户可写的目录"}
	}
	if !sufficient {
		return TargetDirCheck{NormalizedPath: clean, Writable: true, FreeBytes: free, RequiredBytes: required, Message: "目标磁盘可用空间不足以容纳现有数据"}
	}
	return TargetDirCheck{
		Valid: true, NormalizedPath: clean, Writable: true,
		FreeBytes: free, RequiredBytes: required, SufficientSpace: true,
		Message: "目录读写权限与磁盘空间校验通过",
	}
}

func copyDirectoryTree(srcDir, dstDir string) (int, uint64, error) {
	var files int
	var bytesCopied uint64
	err := filepath.WalkDir(srcDir, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		rel, err := filepath.Rel(srcDir, path)
		if err != nil || rel == "." {
			return err
		}
		target := filepath.Join(dstDir, rel)
		if d.IsDir() {
			return os.MkdirAll(target, 0o700)
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o700); err != nil {
			return err
		}
		n, err := copySingleFile(path, target)
		if err != nil {
			return err
		}
		files++
		bytesCopied += n
		return nil
	})
	return files, bytesCopied, err
}

func copySingleFile(src, dst string) (uint64, error) {
	in, err := os.Open(src)
	if err != nil {
		return 0, err
	}
	defer in.Close()
	stat, err := in.Stat()
	if err != nil {
		return 0, err
	}
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return 0, err
	}
	written, copyErr := io.Copy(out, in)
	closeErr := out.Close()
	if copyErr != nil {
		return 0, copyErr
	}
	if closeErr != nil || written != stat.Size() {
		return 0, errors.New("文件复制校验不一致")
	}
	return uint64(written), nil
}
