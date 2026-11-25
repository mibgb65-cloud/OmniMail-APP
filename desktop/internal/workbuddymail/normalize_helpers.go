package workbuddymail

import (
	"encoding/json"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"omnimail/internal/security"
)

func sanitizeServerMessage(raw string) string {
	clean := strings.TrimSpace(security.RedactSensitive(raw))
	clean = strings.Join(strings.Fields(clean), " ")
	return clampRunes(clean, 140)
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if s := strings.TrimSpace(v); s != "" {
			return s
		}
	}
	return ""
}

func parseSingleAddress(raw json.RawMessage) string {
	if list := parseAddressList(raw); len(list) > 0 {
		return list[0]
	}
	return ""
}

func parseAddressList(raw json.RawMessage) []string {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var single string
	if json.Unmarshal(raw, &single) == nil {
		if s := strings.TrimSpace(single); s != "" {
			return []string{s}
		}
		return nil
	}
	var strSlice []string
	if json.Unmarshal(raw, &strSlice) == nil {
		var out []string
		for _, item := range strSlice {
			if s := strings.TrimSpace(item); s != "" {
				out = append(out, s)
			}
		}
		return out
	}
	type addrObj struct {
		Name  string `json:"name"`
		Email string `json:"email"`
	}
	var obj addrObj
	if json.Unmarshal(raw, &obj) == nil && (obj.Email != "" || obj.Name != "") {
		return []string{formatAddrObj(obj.Name, obj.Email)}
	}
	var objSlice []addrObj
	if json.Unmarshal(raw, &objSlice) == nil {
		var out []string
		for _, item := range objSlice {
			if s := formatAddrObj(item.Name, item.Email); s != "" {
				out = append(out, s)
			}
		}
		return out
	}
	return nil
}

func formatAddrObj(name, email string) string {
	n, e := strings.TrimSpace(name), strings.TrimSpace(email)
	if n != "" && e != "" && n != e {
		return n + " <" + e + ">"
	}
	if e != "" {
		return e
	}
	return n
}

func parseTimestamp(raw json.RawMessage) string {
	var str string
	if json.Unmarshal(raw, &str) == nil {
		return strings.TrimSpace(str)
	}
	var num int64
	if json.Unmarshal(raw, &num) == nil && num > 0 {
		if num < 1e11 {
			return time.Unix(num, 0).UTC().Format(time.RFC3339)
		}
		return time.UnixMilli(num).UTC().Format(time.RFC3339)
	}
	return ""
}

func parseOpenedAtUnixMs(raw json.RawMessage) int64 {
	if len(raw) == 0 || string(raw) == "null" {
		return 0
	}
	var num int64
	if json.Unmarshal(raw, &num) == nil {
		return normalizeEpochToMs(num)
	}
	var flt float64
	if json.Unmarshal(raw, &flt) == nil && flt > 0 {
		return normalizeEpochToMs(int64(flt))
	}
	var str string
	if json.Unmarshal(raw, &str) == nil {
		s := strings.TrimSpace(str)
		if s == "" {
			return 0
		}
		if n, err := strconv.ParseInt(s, 10, 64); err == nil {
			return normalizeEpochToMs(n)
		}
		for _, layout := range []string{
			time.RFC3339Nano,
			time.RFC3339,
			"2006-01-02 15:04:05",
			"2006-01-02T15:04:05",
		} {
			if t, err := time.Parse(layout, s); err == nil {
				return t.UnixMilli()
			}
		}
	}
	return 0
}

func normalizeEpochToMs(v int64) int64 {
	if v <= 0 {
		return 0
	}
	if v < 1e11 {
		return v * 1000
	}
	return v
}

func clampRunes(s string, max int) string {
	if utf8.RuneCountInString(s) <= max {
		return s
	}
	return string([]rune(s)[:max])
}
