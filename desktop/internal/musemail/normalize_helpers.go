package musemail

import (
	"encoding/json"
	"strings"
)

func normalizeDirection(rawDir, fromAddr, boundEmail string) string {
	switch strings.ToLower(strings.TrimSpace(rawDir)) {
	case "inbound", "incoming", "received", "in":
		return "inbound"
	case "outbound", "outgoing", "sent", "out":
		return "outbound"
	}
	if boundEmail != "" && normalizeMuseEmailAddress(fromAddr) == boundEmail {
		return "outbound"
	}
	if fromAddr != "" {
		return "inbound"
	}
	return "unknown"
}

func normalizeAttachments(v any) []AttachmentMetaDTO {
	arr, ok := v.([]any)
	if !ok || len(arr) == 0 {
		return []AttachmentMetaDTO{}
	}
	out := make([]AttachmentMetaDTO, 0, len(arr))
	for i, it := range arr {
		if len(out) >= maxAttachments {
			break
		}
		m, ok := it.(map[string]any)
		if !ok {
			continue
		}
		idx := asPositiveInt(m["index"])
		if idx == 0 && m["index"] == nil {
			idx = i
		}
		name := clampRunes(strings.TrimSpace(asString(m["filename"])), 180)
		if name == "" {
			name = "attachment"
		}
		out = append(out, AttachmentMetaDTO{
			Index:    idx,
			Filename: name,
			MimeType: clampRunes(strings.TrimSpace(asString(m["mime_type"])), 96),
			Size:     asPositiveInt64(m["size"]),
		})
	}
	return out
}

func asString(v any) string {
	switch x := v.(type) {
	case string:
		return x
	case json.Number:
		return x.String()
	default:
		return ""
	}
}

func asPositiveInt(v any) int {
	n := asPositiveInt64(v)
	if n > 1000000 {
		return 1000000
	}
	return int(n)
}

func asPositiveInt64(v any) int64 {
	switch x := v.(type) {
	case json.Number:
		if i, err := x.Int64(); err == nil && i > 0 {
			return i
		}
		if f, err := x.Float64(); err == nil && f > 0 {
			return int64(f)
		}
	case float64:
		if x > 0 {
			return int64(x)
		}
	}
	return 0
}

func extractStringList(v any, limit int) []string {
	switch x := v.(type) {
	case string:
		if strings.TrimSpace(x) == "" {
			return []string{}
		}
		parts := strings.Split(x, ",")
		out := make([]string, 0, len(parts))
		for _, p := range parts {
			if t := clampRunes(strings.TrimSpace(p), 254); t != "" {
				out = append(out, t)
			}
			if len(out) >= limit {
				break
			}
		}
		return out
	case []any:
		out := make([]string, 0, len(x))
		for _, item := range x {
			s := ""
			switch elem := item.(type) {
			case string:
				s = elem
			case map[string]any:
				s = firstNonEmpty(asString(elem["email"]), asString(elem["address"]), asString(elem["name"]))
			}
			if t := clampRunes(strings.TrimSpace(s), 254); t != "" {
				out = append(out, t)
			}
			if len(out) >= limit {
				break
			}
		}
		return out
	default:
		return []string{}
	}
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func firstNonNil(vals ...any) any {
	for _, v := range vals {
		if v != nil {
			return v
		}
	}
	return nil
}
