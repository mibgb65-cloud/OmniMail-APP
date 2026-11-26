package updater

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

// UpdatesTempDir 返回受控的更新安装包临时目录 <os.TempDir()>/OmniMail-Updates。
func UpdatesTempDir() string {
	return filepath.Join(os.TempDir(), "OmniMail-Updates")
}

// ValidateTrustedDownloadURL 严格限制仅允许受信任 HTTPS 域名或 OMNIMAIL_RELEASE_FEED_URL 同源地址。
func ValidateTrustedDownloadURL(rawURL string, feedOverride string) error {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" || len(trimmed) > 2048 {
		return errors.New("更新下载链接无效")
	}
	u, err := url.Parse(trimmed)
	if err != nil || u.Host == "" {
		return errors.New("更新下载链接格式非法")
	}
	scheme := strings.ToLower(u.Scheme)
	host := strings.ToLower(u.Hostname())

	if ov := strings.TrimSpace(feedOverride); ov != "" {
		if ovu, err := url.Parse(ov); err == nil && ovu.Host != "" {
			sameOrigin := strings.EqualFold(u.Scheme, ovu.Scheme) && strings.EqualFold(u.Host, ovu.Host)
			if sameOrigin && (scheme == "https" || isLoopbackHost(host)) {
				return nil
			}
		}
	}

	if scheme != "https" {
		return errors.New("仅允许通过 HTTPS 下载受信任更新包")
	}
	if isTrustedGitHubHost(host) {
		return nil
	}
	return fmt.Errorf("已拦截不受信任的更新下载域名：%s", host)
}

func isLoopbackHost(host string) bool {
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func isTrustedGitHubHost(host string) bool {
	if host == "github.com" ||
		host == "api.github.com" ||
		host == "objects.githubusercontent.com" ||
		host == "release-assets.githubusercontent.com" {
		return true
	}
	return strings.HasSuffix(host, ".githubusercontent.com")
}

// SanitizeAssetFileName 校验并返回安全的 Windows 安装包文件名（禁止路径穿越且必须为 .exe）。
func SanitizeAssetFileName(name string) (string, error) {
	trimmed := strings.TrimSpace(name)
	base := filepath.Base(trimmed)
	if base == "" || base == "." || base == ".." || base != trimmed {
		return "", errors.New("更新安装包文件名非法")
	}
	if strings.ContainsAny(base, `/\:*?"<>|`) {
		return "", errors.New("更新安装包文件名包含非法字符")
	}
	if !strings.EqualFold(filepath.Ext(base), ".exe") {
		return "", errors.New("更新安装包必须为 .exe 可执行文件")
	}
	return base, nil
}

// ParseSHA256Sums 从 SHA256SUMS.txt 内容中解析指定资产名（或唯一 .exe 项）的 64 位十六进制摘要。
func ParseSHA256Sums(content string, assetName string) (string, error) {
	target := strings.TrimSpace(assetName)
	type entry struct {
		hash string
		file string
	}
	var entries []entry
	for _, rawLine := range strings.Split(content, "\n") {
		line := strings.TrimSpace(strings.TrimPrefix(rawLine, "\uFEFF"))
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		h := strings.ToLower(strings.TrimSpace(fields[0]))
		if !isHexSHA256(h) {
			continue
		}
		rest := strings.TrimSpace(line[len(fields[0]):])
		rest = strings.TrimPrefix(rest, "*")
		rest = strings.TrimSpace(rest)
		fileBase := filepath.Base(strings.ReplaceAll(rest, "\\", "/"))
		entries = append(entries, entry{hash: h, file: fileBase})
	}
	for _, e := range entries {
		if target != "" && strings.EqualFold(e.file, target) {
			return e.hash, nil
		}
	}
	if len(entries) == 1 && (target == "" || strings.HasSuffix(strings.ToLower(entries[0].file), ".exe")) {
		return entries[0].hash, nil
	}
	return "", errors.New("SHA256SUMS.txt 中未找到对应安装包的 SHA-256 校验值")
}

func isHexSHA256(s string) bool {
	if len(s) != 64 {
		return false
	}
	_, err := hex.DecodeString(s)
	return err == nil
}

// ComputeFileSHA256 计算本地文件的 SHA-256 小写十六进制摘要。
func ComputeFileSHA256(filePath string) (string, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer f.Close()
	sum := sha256.New()
	if _, err := io.Copy(sum, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(sum.Sum(nil)), nil
}

// ValidateInstallerInTempDir 校验目标路径严格位于 UpdatesTempDir() 直接子级且为存在的 .exe 文件。
func ValidateInstallerInTempDir(filePath string) (string, error) {
	trimmed := strings.TrimSpace(filePath)
	if trimmed == "" {
		return "", errors.New("更新安装包路径为空")
	}
	cleanPath := filepath.Clean(trimmed)
	cleanBase := filepath.Clean(UpdatesTempDir())
	if !strings.EqualFold(filepath.Dir(cleanPath), cleanBase) {
		return "", errors.New("拒绝执行非受控更新目录外的安装程序")
	}
	if !strings.EqualFold(filepath.Ext(cleanPath), ".exe") {
		return "", errors.New("目标更新文件不是有效的 .exe 安装程序")
	}
	st, err := os.Stat(cleanPath)
	if err != nil || st.IsDir() || st.Size() <= 0 {
		return "", errors.New("更新安装包文件不存在或已被系统清理")
	}
	return cleanPath, nil
}
