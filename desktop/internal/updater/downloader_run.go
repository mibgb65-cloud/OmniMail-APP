package updater

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func (m *Manager) runDownload(
	ctx context.Context,
	seq uint64,
	req UpdateDownloadRequest,
	feedOverride string,
	userAgent string,
	baseClient *http.Client,
) {
	finalPath := filepath.Join(UpdatesTempDir(), req.AssetName)
	partPath := finalPath + ".part"
	_ = os.Remove(partPath)

	failOrCancel := func(err error) {
		_ = os.Remove(partPath)
		if errors.Is(err, context.Canceled) || ctx.Err() != nil {
			m.EmitStage(ProgressPayload{Stage: "cancelled", Version: req.Version})
			return
		}
		m.emitForSeq(seq, ProgressPayload{Stage: "error", Version: req.Version, Error: err.Error()})
	}

	expectedSHA, err := m.fetchExpectedSHA256(ctx, req.SumsURL, req.AssetName, feedOverride, userAgent, baseClient)
	if err != nil {
		failOrCancel(err)
		return
	}

	if existingSHA, err := ComputeFileSHA256(finalPath); err == nil && strings.EqualFold(existingSHA, expectedSHA) {
		st, _ := os.Stat(finalPath)
		var sz int64
		if st != nil {
			sz = st.Size()
		}
		m.mu.Lock()
		m.verified[strings.ToLower(finalPath)] = expectedSHA
		m.mu.Unlock()
		m.emitForSeq(seq, ProgressPayload{
			Stage: "ready", Version: req.Version, DownloadedBytes: sz, TotalBytes: sz,
			Percent: 100, SHA256: expectedSHA, FilePath: finalPath, AutoInstall: req.AutoInstall,
		})
		return
	}

	dlClient := m.newSafeClient(baseClient, feedOverride, 0)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, req.AssetURL, nil)
	if err != nil {
		failOrCancel(err)
		return
	}
	if userAgent != "" {
		httpReq.Header.Set("User-Agent", userAgent)
	}
	resp, err := dlClient.Do(httpReq)
	if err != nil {
		failOrCancel(fmt.Errorf("下载更新安装包失败：%w", err))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		failOrCancel(fmt.Errorf("下载更新安装包返回 HTTP %d", resp.StatusCode))
		return
	}

	totalBytes := resp.ContentLength
	if totalBytes <= 0 {
		totalBytes = req.AssetSize
	}
	if totalBytes > maxInstallerBytes {
		failOrCancel(errors.New("更新安装包体积超出安全限制"))
		return
	}

	outFile, err := os.OpenFile(partPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		failOrCancel(fmt.Errorf("创建临时更新文件失败：%w", err))
		return
	}

	hasher := sha256.New()
	writer := io.MultiWriter(outFile, hasher)
	buf := make([]byte, 64<<10)
	var downloaded int64
	startedAt := time.Now()
	lastEmit := time.Time{}

	m.emitForSeq(seq, ProgressPayload{
		Stage: "downloading", Version: req.Version, TotalBytes: totalBytes, AutoInstall: req.AutoInstall,
	})

	for {
		n, rErr := resp.Body.Read(buf)
		if n > 0 {
			downloaded += int64(n)
			if downloaded > maxInstallerBytes {
				_ = outFile.Close()
				failOrCancel(errors.New("更新安装包体积超出安全限制"))
				return
			}
			if _, wErr := writer.Write(buf[:n]); wErr != nil {
				_ = outFile.Close()
				failOrCancel(fmt.Errorf("写入更新文件失败：%w", wErr))
				return
			}
			if now := time.Now(); lastEmit.IsZero() || now.Sub(lastEmit) >= 120*time.Millisecond {
				lastEmit = now
				m.emitForSeq(seq, buildDownloadProgress(req, downloaded, totalBytes, startedAt))
			}
		}
		if rErr == io.EOF {
			break
		}
		if rErr != nil {
			_ = outFile.Close()
			failOrCancel(fmt.Errorf("下载流中断：%w", rErr))
			return
		}
	}

	if err := outFile.Sync(); err != nil {
		_ = outFile.Close()
		failOrCancel(err)
		return
	}
	if err := outFile.Close(); err != nil {
		failOrCancel(err)
		return
	}

	finalTotal := max(totalBytes, downloaded)
	m.emitForSeq(seq, ProgressPayload{
		Stage: "verifying", Version: req.Version, DownloadedBytes: downloaded,
		TotalBytes: finalTotal, Percent: 100, AutoInstall: req.AutoInstall,
	})

	actualSHA := hex.EncodeToString(hasher.Sum(nil))
	if !strings.EqualFold(actualSHA, expectedSHA) {
		failOrCancel(errors.New("SHA-256 完整性校验未通过，已自动删除不安全临时包"))
		return
	}

	_ = os.Remove(finalPath)
	if err := os.Rename(partPath, finalPath); err != nil {
		failOrCancel(fmt.Errorf("落盘已校验安装包失败：%w", err))
		return
	}

	m.mu.Lock()
	m.verified[strings.ToLower(finalPath)] = actualSHA
	m.mu.Unlock()
	m.emitForSeq(seq, ProgressPayload{
		Stage: "ready", Version: req.Version, DownloadedBytes: downloaded, TotalBytes: finalTotal,
		Percent: 100, SHA256: actualSHA, FilePath: finalPath, AutoInstall: req.AutoInstall,
	})
}
