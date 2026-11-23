package main

import (
	"strconv"
	"strings"
)

// 以下构建元数据由打包脚本通过 -ldflags "-X main.AppVersion=... -X main.ReleaseChannel=... -X main.BuildTime=..." 单一来源注入。
var (
	AppVersion     = "v0.0.1"
	ReleaseChannel = "stable"
	BuildTime      = "dev"
)

type AppBuildInfo struct {
	Version   string `json:"version"`
	Channel   string `json:"channel"`
	BuildTime string `json:"buildTime"`
	IsBeta    bool   `json:"isBeta"`
}

func normalizedAppVersion() string {
	v := strings.TrimSpace(AppVersion)
	if v == "" {
		return "v0.0.1"
	}
	if !strings.HasPrefix(v, "v") {
		return "v" + v
	}
	return v
}

func normalizedReleaseChannel() string {
	ch := strings.ToLower(strings.TrimSpace(ReleaseChannel))
	if ch == "beta" || strings.Contains(strings.ToLower(AppVersion), ".beta.") {
		return "beta"
	}
	return "stable"
}

// GetAppBuildInfo 返回当前二进制注入的版本号、发布通道与构建时间，供「设置 → 关于」展示。
func (s *DesktopService) GetAppBuildInfo() AppBuildInfo {
	ver := normalizedAppVersion()
	ch := normalizedReleaseChannel()
	bt := strings.TrimSpace(BuildTime)
	if bt == "" {
		bt = "dev"
	}
	return AppBuildInfo{
		Version:   ver,
		Channel:   ch,
		BuildTime: bt,
		IsBeta:    ch == "beta",
	}
}

type parsedReleaseVer struct {
	major  int
	minor  int
	patch  int
	isBeta bool
	beta   int
}

func parseReleaseVersion(raw string) (parsedReleaseVer, bool) {
	s := strings.TrimSpace(raw)
	s = strings.TrimPrefix(s, "v")
	s = strings.TrimPrefix(s, "V")
	if s == "" {
		return parsedReleaseVer{}, false
	}
	// 同时兼容 v0.0.1.beta.1 与 v0.0.1-beta.1
	s = strings.ReplaceAll(s, "-beta.", ".beta.")
	var betaNum int
	isBeta := false
	if idx := strings.Index(s, ".beta."); idx > 0 {
		betaPart := s[idx+len(".beta."):]
		n, err := strconv.Atoi(betaPart)
		if err != nil || n < 0 {
			return parsedReleaseVer{}, false
		}
		isBeta = true
		betaNum = n
		s = s[:idx]
	} else if dash := strings.IndexByte(s, '-'); dash > 0 {
		s = s[:dash]
	}
	parts := strings.Split(s, ".")
	if len(parts) != 3 {
		return parsedReleaseVer{}, false
	}
	maj, err1 := strconv.Atoi(parts[0])
	min, err2 := strconv.Atoi(parts[1])
	pat, err3 := strconv.Atoi(parts[2])
	if err1 != nil || err2 != nil || err3 != nil || maj < 0 || min < 0 || pat < 0 {
		return parsedReleaseVer{}, false
	}
	return parsedReleaseVer{
		major:  maj,
		minor:  min,
		patch:  pat,
		isBeta: isBeta,
		beta:   betaNum,
	}, true
}

func isNewerReleaseVersion(current, candidate string) bool {
	cur, ok1 := parseReleaseVersion(current)
	cand, ok2 := parseReleaseVersion(candidate)
	if !ok1 || !ok2 {
		c1 := strings.TrimPrefix(strings.TrimSpace(current), "v")
		c2 := strings.TrimPrefix(strings.TrimSpace(candidate), "v")
		return c2 != "" && c2 != c1 && c2 > c1
	}
	if cand.major != cur.major {
		return cand.major > cur.major
	}
	if cand.minor != cur.minor {
		return cand.minor > cur.minor
	}
	if cand.patch != cur.patch {
		return cand.patch > cur.patch
	}
	if cur.isBeta && !cand.isBeta {
		return true
	}
	if !cur.isBeta && cand.isBeta {
		return false
	}
	if cur.isBeta && cand.isBeta {
		return cand.beta > cur.beta
	}
	return false
}
