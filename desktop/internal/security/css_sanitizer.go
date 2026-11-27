package security

import (
	"regexp"
	"strconv"
	"strings"
	"unicode"
)

const maxMailCSSBytes = 256 * 1024

var (
	reStyleBlock     = regexp.MustCompile(`(?is)<style\b[^>]*>(.*?)</style>`)
	reCSSComment     = regexp.MustCompile(`(?s)/\*.*?(?:\*/|$)`)
	reCSSHexEscape   = regexp.MustCompile(`\\([0-9a-fA-F]{1,6})[ \t\r\n]?`)
	reHTMLTagInCSS   = regexp.MustCompile(`(?is)</?\s*[a-z!][^>]*>?`)
	reCSSURLToken    = regexp.MustCompile(`(?is)url\s*\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)`)
	reSafeCSSProp    = regexp.MustCompile(`^(?:-[a-z0-9-]+|[a-z][a-z0-9-]*)$`)
	reCSSFixedValue  = regexp.MustCompile(`(?i)\bfixed\b`)
	reHTMLBodyCombo  = regexp.MustCompile(`(?i)(^|[\s,{>;+~])html\s*(?:>\s*)?body\b`)
	reHostRootPseudo = regexp.MustCompile(`(?i):(?:host(?:\([^)]*\))?|root)\b`)
)

func extractAndSanitizeStyleBlocks(rawHTML string) (htmlWithoutStyles string, cleanCSS string, hasRemote bool) {
	source := rawHTML
	if strings.Contains(source, "<!--") {
		source = stripHTMLCommentsOutsideStyle(source)
	}
	if !strings.Contains(strings.ToLower(source), "<style") {
		return source, "", false
	}
	var cssParts []string
	stripped := reStyleBlock.ReplaceAllStringFunc(source, func(block string) string {
		m := reStyleBlock.FindStringSubmatch(block)
		if len(m) == 2 {
			san, rem := SanitizeMailCSS(m[1])
			if rem {
				hasRemote = true
			}
			if san != "" {
				cssParts = append(cssParts, san)
			}
		}
		return ""
	})
	return stripped, strings.Join(cssParts, "\n"), hasRemote
}

// SanitizeMailCSS 白名单净化邮件自带 CSS：禁外链/@import/脚本表达式，降级 fixed，并将 html/body 限定到 .mail-html-inner。
func SanitizeMailCSS(rawCSS string) (cleanCSS string, hasRemoteImages bool) {
	if strings.TrimSpace(rawCSS) == "" {
		return "", false
	}
	if len(rawCSS) > maxMailCSSBytes {
		rawCSS = rawCSS[:maxMailCSSBytes]
	}
	s := reCSSComment.ReplaceAllStringFunc(rawCSS, func(c string) string {
		if reCSSUrlMarker.MatchString("none" + c) {
			return c
		}
		return " "
	})
	s = strings.ReplaceAll(strings.ReplaceAll(s, "<!--", " "), "-->", " ")
	s = decodeCSSEscapes(s)
	// 若包含 </style 等标签闭合注入，直接截断闭合点之后的恶意载荷
	if lower := strings.ToLower(s); strings.Contains(lower, "</style") {
		if idx := strings.Index(lower, "</style"); idx >= 0 {
			s = s[:idx]
		}
	}
	s = reHTMLTagInCSS.ReplaceAllString(s, " ")
	s = strings.ReplaceAll(s, "</", "")

	s = reCSSURLToken.ReplaceAllStringFunc(s, func(tok string) string {
		m := reCSSURLToken.FindStringSubmatch(tok)
		if len(m) == 0 {
			return "none"
		}
		u := strings.TrimSpace(firstNonEmpty(m[1], m[2], m[3]))
		low := strings.ToLower(u)
		if strings.HasPrefix(low, "http://") || strings.HasPrefix(low, "https://") || strings.HasPrefix(low, "//") {
			if cleanURL, valid := sanitizeRemoteImageURL(u); valid {
				hasRemoteImages = true
				return encodeStashedCSSURL(cleanURL)
			}
			return "none"
		}
		if strings.HasPrefix(low, "data:") {
			if safe, ok := normalizeSafeRasterDataURI(u); ok {
				return `url("` + safe + `")`
			}
		}
		return "none"
	})

	cleaned := strings.TrimSpace(sanitizeCSSStatements(s, true))
	return cleaned, hasRemoteImages
}

func decodeCSSEscapes(s string) string {
	if !strings.ContainsRune(s, '\\') {
		return s
	}
	s = reCSSHexEscape.ReplaceAllStringFunc(s, func(m string) string {
		sub := reCSSHexEscape.FindStringSubmatch(m)
		if len(sub) != 2 {
			return ""
		}
		v, err := strconv.ParseInt(sub[1], 16, 32)
		if err != nil || v <= 0 || v > unicode.MaxRune || (v >= 0xD800 && v <= 0xDFFF) {
			return ""
		}
		return string(rune(v))
	})
	var b strings.Builder
	b.Grow(len(s))
	for i := 0; i < len(s); i++ {
		if s[i] == '\\' && i+1 < len(s) {
			next := s[i+1]
			if next != '"' && next != '\'' && next != '\\' {
				b.WriteByte(next)
				i++
				continue
			}
		}
		b.WriteByte(s[i])
	}
	return b.String()
}

func rewriteAndValidateSelectors(raw string) string {
	low := strings.ToLower(raw)
	if strings.ContainsAny(raw, "{};\\") || strings.Contains(low, "javascript:") || strings.Contains(low, "expression(") {
		return ""
	}
	s := reHostRootPseudo.ReplaceAllString(raw, ".mail-html-inner")
	s = reHTMLBodyCombo.ReplaceAllString(s, "${1}.mail-html-inner")
	s = rewriteStandaloneHTMLOrBody(s)
	var valid []string
	for _, part := range splitTopLevelCommas(s) {
		if p := strings.TrimSpace(part); p != "" && !strings.Contains(strings.ToLower(p), "omnimail-") {
			valid = append(valid, p)
		}
	}
	return strings.Join(valid, ", ")
}

func rewriteStandaloneHTMLOrBody(sel string) string {
	var b strings.Builder
	bracket := 0
	for i, n := 0, len(sel); i < n; {
		if sel[i] == '[' {
			bracket++
		} else if sel[i] == ']' && bracket > 0 {
			bracket--
		}
		prevOK := bracket == 0 && (i == 0 || (!isCSSIdentChar(sel[i-1]) && sel[i-1] != '.' && sel[i-1] != '#'))
		if prevOK && i+4 <= n && (i+4 == n || !isCSSIdentChar(sel[i+4])) {
			if w := strings.ToLower(sel[i : i+4]); w == "html" || w == "body" {
				b.WriteString(".mail-html-inner")
				i += 4
				continue
			}
		}
		b.WriteByte(sel[i])
		i++
	}
	return b.String()
}

func isCSSIdentChar(c byte) bool {
	return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_'
}

func splitTopLevelCommas(s string) []string {
	var out []string
	depth, start := 0, 0
	for i := 0; i < len(s); i++ {
		switch s[i] {
		case '(', '[':
			depth++
		case ')', ']':
			if depth > 0 {
				depth--
			}
		case ',':
			if depth == 0 {
				out, start = append(out, s[start:i]), i+1
			}
		}
	}
	return append(out, s[start:])
}
