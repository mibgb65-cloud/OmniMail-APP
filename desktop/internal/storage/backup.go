package storage

import (
	"archive/zip"
	"database/sql"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"omnimail/internal/security"
)

type ExportBackupOptions struct {
	TargetZipPath      string
	IncludeAttachments bool
	IncludeSecrets     bool
	ExportPassword     string
}

// ExportProfileZip 导出单个本地空间为 ZIP 归档，默认不打包任何密钥文件。
func ExportProfileZip(db *sql.DB, vault *security.Vault, profileID, profileDir string, opts ExportBackupOptions) (string, error) {
	exportsDir := filepath.Join(profileDir, "exports")
	if err := os.MkdirAll(exportsDir, 0o700); err != nil {
		return "", err
	}
	outPath := strings.TrimSpace(opts.TargetZipPath)
	if outPath == "" {
		stamp := time.Now().Format("20060102-150405")
		outPath = filepath.Join(exportsDir, fmt.Sprintf("omnimail-profile-%s-%s.zip", profileID, stamp))
	}
	if err := os.MkdirAll(filepath.Dir(outPath), 0o700); err != nil {
		return "", err
	}

	var encryptedVault []byte
	if opts.IncludeSecrets && vault != nil {
		var err error
		encryptedVault, err = vault.ExportEncrypted(opts.ExportPassword)
		if err != nil {
			return "", err
		}
	}

	snapPath := filepath.Join(exportsDir, fmt.Sprintf(".snap-%d.db", time.Now().UnixNano()))
	defer func() { _ = os.Remove(snapPath) }()

	if db != nil {
		escaped := strings.ReplaceAll(snapPath, "'", "''")
		if _, err := db.Exec(fmt.Sprintf("VACUUM INTO '%s';", escaped)); err != nil {
			return "", fmt.Errorf("生成数据库快照失败: %w", err)
		}
	}

	zipFile, err := os.OpenFile(outPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return "", err
	}
	zw := zip.NewWriter(zipFile)

	if _, err := os.Stat(snapPath); err == nil {
		if err := addFileToZip(zw, snapPath, "mail.db"); err != nil {
			_ = zw.Close()
			_ = zipFile.Close()
			return "", err
		}
	}
	settingsPath := filepath.Join(profileDir, "settings.json")
	if _, err := os.Stat(settingsPath); err == nil {
		_ = addFileToZip(zw, settingsPath, "settings.json")
	}

	if opts.IncludeAttachments {
		blobsRoot := filepath.Join(profileDir, "blobs")
		_ = filepath.WalkDir(blobsRoot, func(path string, d fs.DirEntry, walkErr error) error {
			if walkErr != nil || d.IsDir() || strings.HasPrefix(d.Name(), ".") {
				return nil
			}
			rel, relErr := filepath.Rel(profileDir, path)
			if relErr != nil {
				return nil
			}
			return addFileToZip(zw, path, filepath.ToSlash(rel))
		})
	}

	if len(encryptedVault) > 0 {
		w, err := zw.Create("secrets.vault.omvx")
		if err == nil {
			_, _ = w.Write(encryptedVault)
		}
	}

	if err := zw.Close(); err != nil {
		_ = zipFile.Close()
		return "", err
	}
	if err := zipFile.Close(); err != nil {
		return "", err
	}
	return outPath, nil
}

func addFileToZip(zw *zip.Writer, srcPath, zipEntry string) error {
	in, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer in.Close()
	info, err := in.Stat()
	if err != nil {
		return err
	}
	hdr, err := zip.FileInfoHeader(info)
	if err != nil {
		return err
	}
	hdr.Name = zipEntry
	hdr.Method = zip.Deflate
	w, err := zw.CreateHeader(hdr)
	if err != nil {
		return err
	}
	_, err = io.Copy(w, in)
	return err
}
