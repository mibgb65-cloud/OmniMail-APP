package musemail

import (
	"encoding/json"
	"math"
	"net/mail"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	maxThreadIDLen    = 192
	maxSubjectRunes   = 512
	maxPreviewRunes   = 600
	maxBodyRunes      = 256 * 1024
	maxParticipants   = 32
	maxMessagesPerThd = 200
	maxAttachments    = 64
	maxUpstreamCursor = 512
)

func isEmailNotEnabledBody(raw []byte) bool {
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return false
	}
	return isEmailNotEnabledMap(m)
}

func isEmailNotEnabledMap(m map[string]any) bool {
	check := func(v any) bool {
		s, ok := v.(string)
		return ok && strings.EqualFold(strings.TrimSpace(s), "email_not_enabled")
	}
	if check(m["code"]) || check(m["error_code"]) || check(m["error"]) {
		return true
	}
	if errObj, ok := m["error"].(map[string]any); ok {
		return check(errObj["code"]) || check(errObj["type"])
	}
	return false
}

func parseVerifiedMailboxEmail(raw []byte) (string, error) {
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return "", errGatewayFailed("解析 Muse 邮箱身份信息失败")
	}
	if enabled, hasEnabled := m["enabled"].(bool); hasEnabled && !enabled {
		return "", errEmailNotEnabled()
	}
	candidates := []any{
		m["address"],
		m["email"],
		m["email_address"],
		m["mailbox_address"],
	}
	if sub, ok := m["mailbox"].(map[string]any); ok {
		if enabled, hasEnabled := sub["enabled"].(bool); hasEnabled && !enabled {
			return "", errEmailNotEnabled()
		}
		candidates = append(candidates, sub["address"], sub["email"], sub["email_address"])
	}
	for _, cand := range candidates {
		s, ok := cand.(string)
		if !ok {
			continue
		}
		addr := normalizeMuseEmailAddress(s)
		if addr != "" {
			return addr, nil
		}
	}
	return "", errEmailNotEnabled()
}

func normalizeMuseEmailAddress(raw string) string {
	trimmed := strings.ToLower(strings.TrimSpace(raw))
	if trimmed == "" || len(trimmed) > 254 {
		return ""
	}
	parsed, err := mail.ParseAddress(trimmed)
	if err == nil && parsed != nil {
		trimmed = strings.ToLower(strings.TrimSpace(parsed.Address))
	}
	at := strings.LastIndexByte(trimmed, '@')
	if at <= 0 {
		return ""
	}
	domain := trimmed[at+1:]
	if domain != "muse.ai" && !strings.HasSuffix(domain, ".muse.ai") {
		return ""
	}
	return trimmed
}

func parseServerTimestamp(v any) (int64, bool) {
	if v == nil {
		return 0, false
	}
	switch val := v.(type) {
	case float64:
		return normalizeNumericEpoch(val)
	case json.Number:
		if f, err := val.Float64(); err == nil {
			return normalizeNumericEpoch(f)
		}
	case string:
		s := strings.TrimSpace(val)
		if s == "" {
			return 0, false
		}
		if f, err := strconv.ParseFloat(s, 64); err == nil {
			return normalizeNumericEpoch(f)
		}
		for _, layout := range []string{time.RFC3339Nano, time.RFC3339, "2006-01-02 15:04:05", "2006-01-02T15:04:05"} {
			if t, err := time.Parse(layout, s); err == nil && t.Year() >= 2000 {
				return t.UnixMilli(), true
			}
		}
	}
	return 0, false
}

func normalizeNumericEpoch(n float64) (int64, bool) {
	if math.IsNaN(n) || math.IsInf(n, 0) || n <= 0 {
		return 0, false
	}
	// > 1e11 视为毫秒时间戳，否则按秒转换
	if n > 1e11 {
		ms := int64(n)
		if ms < 946684800000 {
			return 0, false
		}
		return ms, true
	}
	sec := int64(n)
	if sec < 946684800 {
		return 0, false
	}
	return sec * 1000, true
}

func clampRunes(s string, maxRunes int) string {
	cleaned := strings.ReplaceAll(s, "\x00", "")
	if utf8.RuneCountInString(cleaned) <= maxRunes {
		return cleaned
	}
	runes := []rune(cleaned)
	return string(runes[:maxRunes])
}
