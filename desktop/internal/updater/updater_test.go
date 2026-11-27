package updater

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestDualChannelReleaseSelectionAndErrors(t *testing.T) {
	releases := []map[string]any{
		{"tag_name": "v0.0.2-alpha.1", "draft": false, "prerelease": true},
		{"tag_name": "v0.0.1-beta.18", "draft": true, "prerelease": true},
		{
			"tag_name": "v0.0.1-beta.17", "draft": false, "prerelease": true,
			"html_url": "https://github.com/mibgb65-cloud/OmniMail-APP/releases/tag/v0.0.1-beta.17",
			"body":     "- 新增静默更新闭环\n- 重构关于页",
			"assets": []map[string]any{
				{
					"name":                 "OmniMail-windows-Setup-v0.0.1.beta.17.exe",
					"browser_download_url": "https://github.com/mibgb65-cloud/OmniMail-APP/releases/download/v0.0.1-beta.17/OmniMail-windows-Setup-v0.0.1.beta.17.exe",
					"size":                 7586923,
				},
				{
					"name":                 "SHA256SUMS.txt",
					"browser_download_url": "https://github.com/mibgb65-cloud/OmniMail-APP/releases/download/v0.0.1-beta.17/SHA256SUMS.txt",
					"size":                 112,
				},
			},
		},
		{"tag_name": "v0.0.0", "draft": false, "prerelease": false},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/ok":
			_ = json.NewEncoder(w).Encode(releases)
		case "/err502":
			w.WriteHeader(http.StatusBadGateway)
		case "/badjson":
			_, _ = w.Write([]byte("{broken-json"))
		}
	}))
	defer srv.Close()

	stableRes, err := CheckRelease(context.Background(), CheckConfig{
		CurrentVersion: "v0.0.1-beta.16",
		Channel:        "stable",
		FeedURL:        srv.URL + "/ok",
	})
	if err != nil || stableRes.HasUpdate {
		t.Fatalf("stable 通道不应命中 alpha/beta 预发布包：res=%+v err=%v", stableRes, err)
	}

	betaRes, err := CheckRelease(context.Background(), CheckConfig{
		CurrentVersion: "v0.0.1-beta.16",
		Channel:        "beta",
		FeedURL:        srv.URL + "/ok",
	})
	if err != nil || !betaRes.HasUpdate || betaRes.LatestVersion != "v0.0.1-beta.17" {
		t.Fatalf("beta 通道应忽略 alpha 并选出最高非草稿版本 v0.0.1-beta.17：res=%+v err=%v", betaRes, err)
	}
	if betaRes.AssetName != "OmniMail-windows-Setup-v0.0.1.beta.17.exe" || betaRes.SumsURL == "" {
		t.Fatalf("资产匹配不完整：%+v", betaRes)
	}

	if _, err := CheckRelease(context.Background(), CheckConfig{
		CurrentVersion: "v0.0.1",
		Channel:        "stable",
		FeedURL:        srv.URL + "/err502",
	}); err == nil {
		t.Fatal("HTTP 非 200 必须明确返回错误，禁止伪装成已是最新")
	}
	if _, err := CheckRelease(context.Background(), CheckConfig{
		CurrentVersion: "v0.0.1",
		Channel:        "stable",
		FeedURL:        srv.URL + "/badjson",
	}); err == nil {
		t.Fatal("非法 JSON 必须明确返回错误")
	}
}

func TestDownloadSHA256VerifyAndUntrustedDomainIntercept(t *testing.T) {
	if err := ValidateTrustedDownloadURL("https://evil.example.com/OmniMail-Setup.exe", ""); err == nil {
		t.Fatal("第三方非授信域名必须被拦截")
	}
	if err := ValidateTrustedDownloadURL("http://github.com/mibgb65-cloud/OmniMail-APP/setup.exe", ""); err == nil {
		t.Fatal("明文 HTTP 下载链接必须被拦截")
	}
	if err := ValidateTrustedDownloadURL("https://release-assets.githubusercontent.com/pkg/OmniMail-Setup.exe", ""); err != nil {
		t.Fatalf("GitHub 官方资产域名应放行：%v", err)
	}

	payload := []byte("MZ-mock-omnimail-installer-binary-payload-v0.0.1.beta.18")
	sumBytes := sha256.Sum256(payload)
	validHash := hex.EncodeToString(sumBytes[:])
	badHash := strings.Repeat("0", 64)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/OmniMail-Setup-test.exe":
			w.Header().Set("Content-Length", fmt.Sprintf("%d", len(payload)))
			_, _ = w.Write(payload)
		case "/sums-ok.txt":
			_, _ = fmt.Fprintf(w, "%s  OmniMail-Setup-test.exe\n", validHash)
		case "/sums-bad.txt":
			_, _ = fmt.Fprintf(w, "%s *OmniMail-Setup-test.exe\n", badHash)
		}
	}))
	defer srv.Close()

	var mu sync.Mutex
	var events []ProgressPayload
	doneCh := make(chan ProgressPayload, 4)
	mgr := NewManager(func(p ProgressPayload) {
		mu.Lock()
		events = append(events, p)
		mu.Unlock()
		if p.Stage == "ready" || p.Stage == "error" {
			doneCh <- p
		}
	})

	assetName := "OmniMail-Setup-test.exe"
	t.Cleanup(func() {
		_ = os.Remove(filepath.Join(UpdatesTempDir(), assetName))
		_ = os.Remove(filepath.Join(UpdatesTempDir(), assetName+".part"))
	})
	_ = os.Remove(filepath.Join(UpdatesTempDir(), assetName))

	err := mgr.StartDownload(UpdateDownloadRequest{
		Version:   "v0.0.1.beta.18",
		AssetName: assetName,
		AssetURL:  srv.URL + "/" + assetName,
		SumsURL:   srv.URL + "/sums-bad.txt",
	}, srv.URL, "OmniMail-Test")
	if err != nil {
		t.Fatalf("启动校验失败场景下载报错：%v", err)
	}
	badEvt := waitProgress(t, doneCh)
	if badEvt.Stage != "error" {
		t.Fatalf("SHA-256 不匹配时必须推送 error 阶段：%+v", badEvt)
	}
	if _, statErr := os.Stat(filepath.Join(UpdatesTempDir(), assetName+".part")); !os.IsNotExist(statErr) {
		t.Fatal("SHA-256 校验失败后必须删除 .part 临时文件")
	}

	if err := mgr.StartDownload(UpdateDownloadRequest{
		Version:     "v0.0.1.beta.18",
		AssetName:   assetName,
		AssetURL:    srv.URL + "/" + assetName,
		SumsURL:     srv.URL + "/sums-ok.txt",
		AutoInstall: true,
	}, srv.URL, "OmniMail-Test"); err != nil {
		t.Fatalf("启动正常校验场景下载报错：%v", err)
	}
	okEvt := waitProgress(t, doneCh)
	if okEvt.Stage != "ready" || okEvt.SHA256 != validHash {
		t.Fatalf("下载完成应进入 ready 并附带匹配哈希：%+v", okEvt)
	}
	if _, _, vErr := mgr.EnsureVerified(okEvt.FilePath); vErr != nil {
		t.Fatalf("已通过 SHA-256 校验的安装包应通过复核：%v", vErr)
	}
}

func TestBuildNSISCommandLineWithSpacesAndRelaunch(t *testing.T) {
	cmd := BuildNSISCommandLine(
		`C:\Users\Admin User\AppData\Local\Temp\OmniMail-Updates\OmniMail-Setup-v0.0.1-windows-amd64.exe`,
		"AllUsers",
		`C:\Program Files\OmniMail Studio\OmniMail`,
		true,
	)
	wantSuffix := `/S /RELAUNCH /AllUsers /D=C:\Program Files\OmniMail Studio\OmniMail`
	if !strings.HasSuffix(cmd, wantSuffix) {
		t.Fatalf("NSIS 静默命令行尾参格式错误：%s", cmd)
	}
	if strings.Contains(cmd, `"/D=`) || strings.HasSuffix(cmd, `OmniMail"`) {
		t.Fatalf("NSIS /D= 参数禁止包含额外引号：%s", cmd)
	}
}

func waitProgress(t *testing.T, ch <-chan ProgressPayload) ProgressPayload {
	t.Helper()
	select {
	case p := <-ch:
		return p
	case <-time.After(5 * time.Second):
		t.Fatal("等待下载进度事件超时")
		return ProgressPayload{}
	}
}
