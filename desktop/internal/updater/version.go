package updater

import (
	"fmt"
	"strconv"
	"strings"
)

const (
	stageAlpha  = 0
	stageBeta   = 1
	stageStable = 2
)

// NormalizeVersion 规范化版本号前缀为小写 v 开头。
func NormalizeVersion(raw string) string {
	v := strings.TrimSpace(raw)
	if v == "" {
		return "v0.0.1"
	}
	v = strings.TrimPrefix(v, "V")
	if !strings.HasPrefix(v, "v") {
		return "v" + v
	}
	return v
}

// NormalizeChannel 将渠道名归一化为 stable、beta 或 alpha（本地开发构建）。
func NormalizeChannel(raw string, fallbackVersion string) string {
	ch := strings.ToLower(strings.TrimSpace(raw))
	if ch == "alpha" || ch == "beta" || ch == "stable" {
		return ch
	}
	if IsAlphaVersion(fallbackVersion) {
		return "alpha"
	}
	if IsBetaVersion(fallbackVersion) {
		return "beta"
	}
	return "stable"
}

// IsAlphaVersion 判断版本号是否带有 alpha 本地开发预发布标识。
func IsAlphaVersion(raw string) bool {
	low := strings.ToLower(strings.TrimSpace(raw))
	return strings.Contains(low, "-alpha.") || strings.Contains(low, ".alpha.")
}

// IsBetaVersion 判断版本号是否带有 beta 测试预发布标识。
func IsBetaVersion(raw string) bool {
	low := strings.ToLower(strings.TrimSpace(raw))
	return strings.Contains(low, "-beta.") || strings.Contains(low, ".beta.")
}

// InstallerAssetFileName 按规范生成 Windows 安装包标准文件名：
// OmniMail-windows-Setup-vX.Y.Z.exe / .beta.N.exe / .alpha.N.exe。
func InstallerAssetFileName(raw string) string {
	p, ok := parseVersion(raw)
	if !ok {
		return fmt.Sprintf("OmniMail-windows-Setup-%s.exe", NormalizeVersion(raw))
	}
	switch p.stage {
	case stageAlpha:
		return fmt.Sprintf("OmniMail-windows-Setup-v%d.%d.%d.alpha.%d.exe", p.major, p.minor, p.patch, p.pre)
	case stageBeta:
		return fmt.Sprintf("OmniMail-windows-Setup-v%d.%d.%d.beta.%d.exe", p.major, p.minor, p.patch, p.pre)
	default:
		return fmt.Sprintf("OmniMail-windows-Setup-v%d.%d.%d.exe", p.major, p.minor, p.patch)
	}
}

type parsedVer struct {
	major int
	minor int
	patch int
	stage int
	pre   int
}

func parseVersion(raw string) (parsedVer, bool) {
	s := strings.TrimSpace(raw)
	s = strings.TrimPrefix(s, "v")
	s = strings.TrimPrefix(s, "V")
	if s == "" {
		return parsedVer{}, false
	}
	low := strings.ToLower(s)
	low = strings.ReplaceAll(low, "-alpha.", ".alpha.")
	low = strings.ReplaceAll(low, "-beta.", ".beta.")

	stage := stageStable
	preNum := 0
	if idx := strings.Index(low, ".alpha."); idx > 0 {
		n, err := strconv.Atoi(low[idx+len(".alpha."):])
		if err != nil || n < 0 {
			return parsedVer{}, false
		}
		stage, preNum, low = stageAlpha, n, low[:idx]
	} else if idx := strings.Index(low, ".beta."); idx > 0 {
		n, err := strconv.Atoi(low[idx+len(".beta."):])
		if err != nil || n < 0 {
			return parsedVer{}, false
		}
		stage, preNum, low = stageBeta, n, low[:idx]
	} else if dash := strings.IndexByte(low, '-'); dash > 0 {
		return parsedVer{}, false
	}

	parts := strings.Split(low, ".")
	if len(parts) != 3 {
		return parsedVer{}, false
	}
	maj, err1 := strconv.Atoi(parts[0])
	min, err2 := strconv.Atoi(parts[1])
	pat, err3 := strconv.Atoi(parts[2])
	if err1 != nil || err2 != nil || err3 != nil || maj < 0 || min < 0 || pat < 0 {
		return parsedVer{}, false
	}
	return parsedVer{major: maj, minor: min, patch: pat, stage: stage, pre: preNum}, true
}

// IsNewerVersion 判断 candidate 是否比 current 更新（同主次修订号 alpha < beta < stable）。
func IsNewerVersion(current, candidate string) bool {
	cur, ok1 := parseVersion(current)
	cand, ok2 := parseVersion(candidate)
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
	if cand.stage != cur.stage {
		return cand.stage > cur.stage
	}
	if cand.stage != stageStable {
		return cand.pre > cur.pre
	}
	return false
}
