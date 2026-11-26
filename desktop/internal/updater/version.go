package updater

import (
	"strconv"
	"strings"
)

// NormalizeVersion 规范化版本号为 vX.Y.Z 或 vX.Y.Z.beta.N 形态。
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

// NormalizeChannel 将渠道名归一化为 stable 或 beta。
func NormalizeChannel(raw string, fallbackVersion string) string {
	ch := strings.ToLower(strings.TrimSpace(raw))
	if ch == "beta" {
		return "beta"
	}
	if ch == "stable" {
		return "stable"
	}
	lowVer := strings.ToLower(strings.TrimSpace(fallbackVersion))
	if strings.Contains(lowVer, ".beta.") || strings.Contains(lowVer, "-beta.") {
		return "beta"
	}
	return "stable"
}

// IsBetaVersion 判断版本号是否带有 beta 预发布标识。
func IsBetaVersion(raw string) bool {
	low := strings.ToLower(strings.TrimSpace(raw))
	return strings.Contains(low, ".beta.") || strings.Contains(low, "-beta.")
}

type parsedVer struct {
	major  int
	minor  int
	patch  int
	isBeta bool
	beta   int
}

func parseVersion(raw string) (parsedVer, bool) {
	s := strings.TrimSpace(raw)
	s = strings.TrimPrefix(s, "v")
	s = strings.TrimPrefix(s, "V")
	if s == "" {
		return parsedVer{}, false
	}
	s = strings.ReplaceAll(strings.ToLower(s), "-beta.", ".beta.")
	var betaNum int
	isBeta := false
	if idx := strings.Index(s, ".beta."); idx > 0 {
		betaPart := s[idx+len(".beta."):]
		n, err := strconv.Atoi(betaPart)
		if err != nil || n < 0 {
			return parsedVer{}, false
		}
		isBeta = true
		betaNum = n
		s = s[:idx]
	} else if dash := strings.IndexByte(s, '-'); dash > 0 {
		s = s[:dash]
	}
	parts := strings.Split(s, ".")
	if len(parts) != 3 {
		return parsedVer{}, false
	}
	maj, err1 := strconv.Atoi(parts[0])
	min, err2 := strconv.Atoi(parts[1])
	pat, err3 := strconv.Atoi(parts[2])
	if err1 != nil || err2 != nil || err3 != nil || maj < 0 || min < 0 || pat < 0 {
		return parsedVer{}, false
	}
	return parsedVer{
		major:  maj,
		minor:  min,
		patch:  pat,
		isBeta: isBeta,
		beta:   betaNum,
	}, true
}

// IsNewerVersion 判断 candidate 是否比 current 更新（同主次修订号正式版高于 beta）。
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
