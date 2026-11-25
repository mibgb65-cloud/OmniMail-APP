package mailproto

import (
	stdmail "net/mail"
	"regexp"
	"strings"
)

var (
	reRFC2047Charset = regexp.MustCompile(`(?i)=\?([a-z0-9._\-]+)\?[bq]\?`)
	reHeaderCTParam  = regexp.MustCompile(`(?i)\bcharset\s*=\s*["']?([a-z0-9._\-]+)["']?`)
	reAngleEmailAddr = regexp.MustCompile(`<\s*([^<>@\s]+@[^<>@\s]+)\s*>`)
	reBareEmailAddr  = regexp.MustCompile(`[A-Za-z0-9.!#$%&'*+/=?^_` + "`" + `{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+`)
)

// DetectHeaderCharsetHint 从邮件头块（如 Subject RFC2047 标记或 Content-Type）推断非 UTF-8 字符集提示。
func DetectHeaderCharsetHint(rawHeaders string) string {
	for _, m := range reRFC2047Charset.FindAllStringSubmatch(rawHeaders, -1) {
		if c := normalizeHintLabel(m[1]); c != "" {
			return c
		}
	}
	for _, m := range reHeaderCTParam.FindAllStringSubmatch(rawHeaders, -1) {
		if c := normalizeHintLabel(m[1]); c != "" {
			return c
		}
	}
	return ""
}

func normalizeHintLabel(raw string) string {
	switch norm := strings.ToLower(strings.TrimSpace(raw)); norm {
	case "", "utf-8", "utf8", "us-ascii", "ascii":
		return ""
	default:
		return norm
	}
}

// ExtractRawHeaderValues 从原始邮件头块中展开折行并提取指定字段名的原始字节串。
func ExtractRawHeaderValues(rawHeaders, key string) []string {
	if rawHeaders == "" {
		return nil
	}
	lines := strings.Split(strings.ReplaceAll(rawHeaders, "\r\n", "\n"), "\n")
	var unfolded []string
	for _, line := range lines {
		if line == "" {
			break
		}
		if (strings.HasPrefix(line, " ") || strings.HasPrefix(line, "\t")) && len(unfolded) > 0 {
			unfolded[len(unfolded)-1] += " " + strings.TrimLeft(line, " \t")
			continue
		}
		unfolded = append(unfolded, line)
	}
	var vals []string
	for _, u := range unfolded {
		colon := strings.IndexByte(u, ':')
		if colon <= 0 {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(u[:colon]), key) {
			vals = append(vals, strings.TrimSpace(u[colon+1:]))
		}
	}
	return vals
}

// ParseHeaderBlockEnvelope 直接从原始邮件头块容错解析主题与发/收件人列表（供实时解析与存量迁移共用）。
func ParseHeaderBlockEnvelope(rawHeaders string) (subject string, sender EmailAddress, replyTo, to, cc []EmailAddress) {
	hint := DetectHeaderCharsetHint(rawHeaders)
	if subs := ExtractRawHeaderValues(rawHeaders, "Subject"); len(subs) > 0 {
		subject = strings.TrimSpace(DecodeHeaderTextWithHint(subs[0], hint))
	}
	froms := parseHeaderKeyVals(ExtractRawHeaderValues(rawHeaders, "From"), hint)
	if len(froms) > 0 {
		sender = froms[0]
	}
	replyTo = parseHeaderKeyVals(ExtractRawHeaderValues(rawHeaders, "Reply-To"), hint)
	to = parseHeaderKeyVals(ExtractRawHeaderValues(rawHeaders, "To"), hint)
	cc = parseHeaderKeyVals(ExtractRawHeaderValues(rawHeaders, "Cc"), hint)
	return
}

func parseHeaderKeyVals(vals []string, hint string) []EmailAddress {
	var out []EmailAddress
	for _, v := range vals {
		out = append(out, ParseAddressHeader(v, hint)...)
	}
	return out
}

// ParseAddressHeader 先做 RFC2047 与裸字节 UTF-8 解码，优先尝试标准解析，失败时执行尖括号容错提取。
func ParseAddressHeader(rawVal string, hintCharset string) []EmailAddress {
	flat := strings.ReplaceAll(strings.ReplaceAll(rawVal, "\r\n", " "), "\n", " ")
	decoded := strings.TrimSpace(DecodeHeaderTextWithHint(flat, hintCharset))
	if decoded == "" {
		return nil
	}
	if list, err := stdmail.ParseAddressList(decoded); err == nil && len(list) > 0 {
		out := make([]EmailAddress, 0, len(list))
		allClean := true
		for _, a := range list {
			addr := cleanEmailAddr(a.Address)
			if addr == "" {
				allClean = false
				break
			}
			name := cleanDisplayName(a.Name, hintCharset)
			out = append(out, finalizeEmailAddress(name, addr))
		}
		if allClean {
			return out
		}
	}
	return parseAddressListTolerant(decoded, hintCharset)
}

func parseAddressListTolerant(decoded, hint string) []EmailAddress {
	var out []EmailAddress
	for _, seg := range splitAddressSegments(decoded) {
		seg = strings.TrimSpace(seg)
		if seg == "" {
			continue
		}
		if idx := reAngleEmailAddr.FindAllStringSubmatchIndex(seg, -1); len(idx) > 0 {
			last := idx[len(idx)-1]
			if email := cleanEmailAddr(seg[last[2]:last[3]]); email != "" {
				out = append(out, finalizeEmailAddress(cleanDisplayName(seg[:last[0]]+" "+seg[last[1]:], hint), email))
				continue
			}
		}
		if idx := reBareEmailAddr.FindAllStringIndex(seg, -1); len(idx) > 0 {
			last := idx[len(idx)-1]
			if email := cleanEmailAddr(seg[last[0]:last[1]]); email != "" {
				out = append(out, finalizeEmailAddress(cleanDisplayName(seg[:last[0]]+" "+seg[last[1]:], hint), email))
				continue
			}
		}
		if name := cleanDisplayName(strings.TrimRight(seg, ":; "), hint); name != "" {
			out = append(out, EmailAddress{Name: name, Email: ""})
		}
	}
	return out
}

func splitAddressSegments(s string) []string {
	var out []string
	inQuote, escaped, start := false, false, 0
	for i := 0; i < len(s); i++ {
		switch ch := s[i]; {
		case escaped:
			escaped = false
		case ch == '\\' && inQuote:
			escaped = true
		case ch == '"':
			inQuote = !inQuote
		case !inQuote && (ch == ',' || ch == ';'):
			out, start = append(out, s[start:i]), i+1
		}
	}
	return append(out, s[start:])
}

func cleanDisplayName(raw, hint string) string {
	s := strings.TrimSpace(DecodeHeaderTextWithHint(raw, hint))
	for i := 0; i < 3; i++ {
		n := strings.TrimSpace(s)
		if len(n) >= 2 && ((n[0] == '"' && n[len(n)-1] == '"') || (n[0] == '\'' && n[len(n)-1] == '\'') || (n[0] == '<' && n[len(n)-1] == '>')) {
			s = n[1 : len(n)-1]
		} else {
			break
		}
	}
	return strings.TrimSpace(strings.Trim(s, `"'<>`))
}

func cleanEmailAddr(raw string) string {
	s := strings.ToLower(strings.TrimSpace(strings.Trim(raw, "<>\"' \t\r\n")))
	at := strings.IndexByte(s, '@')
	if s == "" || strings.ContainsAny(s, "<> \t\r\n\"'") || at <= 0 || at != strings.LastIndexByte(s, '@') || at >= len(s)-1 {
		return ""
	}
	return s
}

func finalizeEmailAddress(name, addr string) EmailAddress {
	if name == "" && addr != "" {
		name = addr
		if at := strings.IndexByte(addr, '@'); at > 0 {
			name = addr[:at]
		}
	}
	return EmailAddress{Name: name, Email: addr}
}
