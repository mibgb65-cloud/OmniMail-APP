package security

import (
	"regexp"
	"strings"
)

var reDownlevelRevealed = regexp.MustCompile(`(?i)<!\[(?:if|endif)[^\]]*\]>`)

// stripHTMLCommentsOutsideStyle 在提取 <style> 前剥离顶层 HTML 注释与 Outlook MSO 条件注释，同时保护常规 <style><!-- ... --></style> 包裹内容。
func stripHTMLCommentsOutsideStyle(raw string) string {
	var b strings.Builder
	b.Grow(len(raw))
	inStyle := false
	for i, n := 0, len(raw); i < n; {
		if !inStyle && strings.HasPrefix(raw[i:], "<!--") {
			end := strings.Index(raw[i+4:], "-->")
			if end < 0 {
				break
			}
			i += 4 + end + 3
			continue
		}
		if raw[i] == '<' {
			if !inStyle && hasTagPrefixFold(raw[i:], "<style") {
				tagEnd := strings.IndexByte(raw[i:], '>')
				if tagEnd < 0 {
					b.WriteString(raw[i:])
					break
				}
				inStyle = true
				b.WriteString(raw[i : i+tagEnd+1])
				i += tagEnd + 1
				continue
			}
			if inStyle && hasTagPrefixFold(raw[i:], "</style") {
				tagEnd := strings.IndexByte(raw[i:], '>')
				if tagEnd < 0 {
					b.WriteString(raw[i:])
					break
				}
				inStyle = false
				b.WriteString(raw[i : i+tagEnd+1])
				i += tagEnd + 1
				continue
			}
		}
		b.WriteByte(raw[i])
		i++
	}
	out := b.String()
	if strings.Contains(out, "<![") {
		out = reDownlevelRevealed.ReplaceAllString(out, "")
	}
	return out
}

func hasTagPrefixFold(s, prefix string) bool {
	if len(s) < len(prefix) || !strings.EqualFold(s[:len(prefix)], prefix) {
		return false
	}
	if len(s) == len(prefix) {
		return true
	}
	next := s[len(prefix)]
	return next <= ' ' || next == '>' || next == '/'
}
