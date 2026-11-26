package updater

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

const maxInstallerBytes = 350 << 20 // 350 MB 安全上限

// Manager 管理后台更新下载会话、重定向安全校验、SHA-256 比对及已校验文件白名单。
type Manager struct {
	mu       sync.Mutex
	emit     func(ProgressPayload)
	client   *http.Client
	cancel   context.CancelFunc
	runSeq   uint64
	verified map[string]string
}

func NewManager(emit func(ProgressPayload)) *Manager {
	return &Manager{
		emit:     emit,
		verified: make(map[string]string),
	}
}

func (m *Manager) SetHTTPClient(c *http.Client) {
	m.mu.Lock()
	m.client = c
	m.mu.Unlock()
}

// StartDownload 启动异步流式下载与 SHA-256 强校验（前置校验非法输入时同步返回错误）。
func (m *Manager) StartDownload(req UpdateDownloadRequest, feedOverride string, userAgent string) error {
	assetName, err := SanitizeAssetFileName(req.AssetName)
	if err != nil {
		return err
	}
	if err := ValidateTrustedDownloadURL(req.AssetURL, feedOverride); err != nil {
		return err
	}
	if strings.TrimSpace(req.SumsURL) == "" {
		return errors.New("缺少 SHA256SUMS.txt 校验文件链接，已拒绝不安全更新")
	}
	if err := ValidateTrustedDownloadURL(req.SumsURL, feedOverride); err != nil {
		return err
	}
	if err := os.MkdirAll(UpdatesTempDir(), 0o700); err != nil {
		return fmt.Errorf("无法创建更新缓存目录：%w", err)
	}

	m.mu.Lock()
	if m.cancel != nil {
		m.cancel()
	}
	m.runSeq++
	seq := m.runSeq
	ctx, cancel := context.WithCancel(context.Background())
	m.cancel = cancel
	baseClient := m.client
	m.mu.Unlock()

	req.AssetName = assetName
	req.Version = NormalizeVersion(req.Version)
	go m.runDownload(ctx, seq, req, feedOverride, userAgent, baseClient)
	return nil
}

// CancelDownload 中止进行中的更新下载并清理临时文件。
func (m *Manager) CancelDownload() {
	m.mu.Lock()
	m.runSeq++
	cancel := m.cancel
	m.cancel = nil
	m.mu.Unlock()
	if cancel != nil {
		cancel()
	}
}

// EnsureVerified 确认目标安装包路径已在当前会话通过 SHA-256 强校验且未被篡改。
func (m *Manager) EnsureVerified(filePath string) (string, string, error) {
	cleanPath, err := ValidateInstallerInTempDir(filePath)
	if err != nil {
		return "", "", err
	}
	key := strings.ToLower(cleanPath)
	m.mu.Lock()
	expectedHash := m.verified[key]
	m.mu.Unlock()
	if expectedHash == "" {
		return "", "", errors.New("该安装包尚未完成 SHA-256 安全校验，已拒绝执行")
	}
	actualHash, err := ComputeFileSHA256(cleanPath)
	if err != nil {
		return "", "", fmt.Errorf("复核安装包哈希失败：%w", err)
	}
	if !strings.EqualFold(actualHash, expectedHash) {
		_ = os.Remove(cleanPath)
		return "", "", errors.New("安装包文件校验和不匹配，已被移除")
	}
	return cleanPath, actualHash, nil
}

func (m *Manager) emitForSeq(seq uint64, p ProgressPayload) {
	m.mu.Lock()
	ok := m.runSeq == seq
	fn := m.emit
	m.mu.Unlock()
	if ok && fn != nil {
		fn(p)
	}
}

// EmitStage 主动广播安装阶段状态（如 installing）。
func (m *Manager) EmitStage(p ProgressPayload) {
	m.mu.Lock()
	fn := m.emit
	m.mu.Unlock()
	if fn != nil {
		fn(p)
	}
}

func (m *Manager) newSafeClient(base *http.Client, feedOverride string, timeout time.Duration) *http.Client {
	transport := http.DefaultTransport
	if base != nil && base.Transport != nil {
		transport = base.Transport
	}
	return &http.Client{
		Transport: transport,
		Timeout:   timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return errors.New("更新下载重定向次数过多")
			}
			return ValidateTrustedDownloadURL(req.URL.String(), feedOverride)
		},
	}
}

func (m *Manager) fetchExpectedSHA256(ctx context.Context, sumsURL, assetName, feedOverride, ua string, base *http.Client) (string, error) {
	client := m.newSafeClient(base, feedOverride, 20*time.Second)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sumsURL, nil)
	if err != nil {
		return "", err
	}
	if ua != "" {
		req.Header.Set("User-Agent", ua)
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("拉取 SHA256SUMS.txt 失败：%w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("拉取 SHA256SUMS.txt 返回 HTTP %d", resp.StatusCode)
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 256<<10))
	if err != nil {
		return "", err
	}
	return ParseSHA256Sums(string(raw), assetName)
}

func buildDownloadProgress(req UpdateDownloadRequest, downloaded, total int64, started time.Time) ProgressPayload {
	elapsedSec := time.Since(started).Seconds()
	var speed int64
	if elapsedSec > 0.05 {
		speed = int64(float64(downloaded) / elapsedSec)
	}
	pct := 0
	if total > 0 {
		pct = int((downloaded * 100) / total)
		if pct > 99 {
			pct = 99
		}
	}
	return ProgressPayload{
		Stage:           "downloading",
		Version:         req.Version,
		DownloadedBytes: downloaded,
		TotalBytes:      total,
		SpeedBps:        speed,
		Percent:         pct,
		AutoInstall:     req.AutoInstall,
	}
}
