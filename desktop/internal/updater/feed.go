package updater

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// CheckConfig 描述双通道 GitHub Release 查询参数。
type CheckConfig struct {
	CurrentVersion string
	Channel        string
	Repo           string
	FeedURL        string
	HTTPClient     *http.Client
	Timeout        time.Duration
}

type ghAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
	Size               int64  `json:"size"`
}

type ghRelease struct {
	TagName     string    `json:"tag_name"`
	HTMLURL     string    `json:"html_url"`
	Body        string    `json:"body"`
	Draft       bool      `json:"draft"`
	Prerelease  bool      `json:"prerelease"`
	PublishedAt string    `json:"published_at"`
	Assets      []ghAsset `json:"assets"`
}

// CheckRelease 拉取远端 Release 源并按 stable / beta 通道规则筛选最新版本，如实返回网络或协议错误。
func CheckRelease(ctx context.Context, cfg CheckConfig) (UpdateCheckResult, error) {
	now := time.Now()
	curVer := NormalizeVersion(cfg.CurrentVersion)
	channel := NormalizeChannel(cfg.Channel, curVer)
	repo := strings.Trim(strings.TrimSpace(cfg.Repo), "/")
	if repo == "" {
		repo = "mibgb65-cloud/OmniMail-APP"
	}

	res := UpdateCheckResult{
		CurrentVersion: curVer,
		LatestVersion:  curVer,
		Channel:        channel,
		HasUpdate:      false,
		ReleaseURL:     fmt.Sprintf("https://github.com/%s/releases", repo),
		CheckedAt:      now.Format("2006-01-02 15:04"),
		CheckedAtUnix:  now.UnixMilli(),
	}

	apiURL := strings.TrimSpace(cfg.FeedURL)
	if apiURL == "" {
		if channel == "stable" {
			apiURL = fmt.Sprintf("https://api.github.com/repos/%s/releases?per_page=15", repo)
		} else {
			apiURL = fmt.Sprintf("https://api.github.com/repos/%s/releases?per_page=15", repo)
		}
	}

	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	reqCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, apiURL, nil)
	if err != nil {
		res.ErrorMessage = "无效的更新检查地址：" + err.Error()
		return res, errors.New(res.ErrorMessage)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "OmniMail-Desktop/"+curVer)

	client := cfg.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		res.ErrorMessage = "无法连接更新服务器：" + err.Error()
		return res, errors.New(res.ErrorMessage)
	}
	defer resp.Body.Close()

	bodyBytes, readErr := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if readErr != nil {
		res.ErrorMessage = "读取更新响应失败：" + readErr.Error()
		return res, errors.New(res.ErrorMessage)
	}
	if resp.StatusCode != http.StatusOK {
		res.ErrorMessage = fmt.Sprintf("更新服务器返回 HTTP %d", resp.StatusCode)
		return res, errors.New(res.ErrorMessage)
	}

	releases, err := decodeReleasesJSON(bodyBytes)
	if err != nil {
		res.ErrorMessage = "解析版本发布元数据失败：" + err.Error()
		return res, errors.New(res.ErrorMessage)
	}

	best, found := selectBestRelease(releases, channel)
	if !found {
		return res, nil
	}

	bestVer := NormalizeVersion(best.TagName)
	res.HasUpdate = IsNewerVersion(curVer, bestVer)
	if res.HasUpdate || strings.EqualFold(bestVer, curVer) {
		res.LatestVersion = bestVer
		if strings.TrimSpace(best.HTMLURL) != "" {
			res.ReleaseURL = strings.TrimSpace(best.HTMLURL)
		}
		res.ReleaseNotes = strings.TrimSpace(best.Body)
		res.PublishedAt = strings.TrimSpace(best.PublishedAt)
		assetName, assetURL, assetSize, sumsURL := matchWindowsAssets(best.TagName, bestVer, best.Assets)
		res.AssetName = assetName
		res.AssetURL = assetURL
		res.AssetSize = assetSize
		res.SumsURL = sumsURL
	}
	return res, nil
}

func decodeReleasesJSON(raw []byte) ([]ghRelease, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return nil, errors.New("响应内容为空")
	}
	if trimmed[0] == '[' {
		var list []ghRelease
		if err := json.Unmarshal(trimmed, &list); err != nil {
			return nil, err
		}
		return list, nil
	}
	var single ghRelease
	if err := json.Unmarshal(trimmed, &single); err != nil {
		return nil, err
	}
	return []ghRelease{single}, nil
}

func selectBestRelease(list []ghRelease, channel string) (ghRelease, bool) {
	var best ghRelease
	found := false
	for _, r := range list {
		if r.Draft || strings.TrimSpace(r.TagName) == "" {
			continue
		}
		if channel == "stable" && (r.Prerelease || IsBetaVersion(r.TagName)) {
			continue
		}
		if !found || IsNewerVersion(best.TagName, r.TagName) {
			best = r
			found = true
		}
	}
	return best, found
}

func matchWindowsAssets(rawTag string, normVer string, assets []ghAsset) (string, string, int64, string) {
	var exeAsset *ghAsset
	var sumsURL string
	exactA := fmt.Sprintf("OmniMail-Setup-%s-windows-amd64.exe", strings.TrimSpace(rawTag))
	exactB := fmt.Sprintf("OmniMail-Setup-%s-windows-amd64.exe", normVer)

	for i := range assets {
		a := &assets[i]
		name := strings.TrimSpace(a.Name)
		low := strings.ToLower(name)
		if low == "sha256sums.txt" || strings.HasSuffix(low, "sha256sums.txt") {
			sumsURL = strings.TrimSpace(a.BrowserDownloadURL)
			continue
		}
		if strings.EqualFold(name, exactA) || strings.EqualFold(name, exactB) {
			exeAsset = a
			continue
		}
		if exeAsset == nil && strings.HasSuffix(low, ".exe") &&
			(strings.Contains(low, "windows-amd64") || strings.Contains(low, "setup")) {
			exeAsset = a
		}
	}
	if exeAsset == nil {
		return "", "", 0, sumsURL
	}
	return strings.TrimSpace(exeAsset.Name), strings.TrimSpace(exeAsset.BrowserDownloadURL), exeAsset.Size, sumsURL
}
