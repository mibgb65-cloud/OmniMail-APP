package security

import (
	"html"
	"net/url"
	"regexp"
	"strings"
)

var reImgSrcAttr = regexp.MustCompile(`(?is)\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+))`)

// scanImgTags 在不跨 '<' 吞噬后续标签、也不让漏开引号拉穿当前 '>' 的前提下逐个扫描 <img ...> 标签。
func scanImgTags(input string, rewrite func(tag string) string) string {
	var b strings.Builder
	b.Grow(len(input))
	for i, n := 0, len(input); i < n; {
		if input[i] == '<' && hasTagPrefixFold(input[i:], "<img") {
			end := findBoundedImgTagEnd(input, i)
			if end > i {
				b.WriteString(rewrite(input[i:end]))
				i = end
				continue
			}
		}
		b.WriteByte(input[i])
		i++
	}
	return b.String()
}

// findBoundedImgTagEnd 查找单个 <img ...> 的闭合 '>' 下标（返回 '>' 后一位）。
// 仅当引号紧跟在 '=' 之后才进入配对引号态；若引号内意外遇到新标签 '<' 或 EOF，则回退在首个 '>' 截断，杜绝跨标签吞噬。
func findBoundedImgTagEnd(s string, start int) int {
	n := len(s)
	var quote byte
	afterEq := false
	firstGtInQuote := -1

	for j := start + 4; j < n; j++ {
		ch := s[j]
		if quote != 0 {
			if ch == quote {
				quote = 0
				firstGtInQuote = -1
				continue
			}
			if ch == '>' && firstGtInQuote < 0 {
				firstGtInQuote = j
			}
			if ch == '<' && firstGtInQuote >= 0 {
				return firstGtInQuote + 1
			}
			continue
		}
		switch {
		case ch == '>':
			return j + 1
		case ch == '<':
			return -1
		case ch == '=':
			afterEq = true
		case ch == '"' || ch == '\'':
			if afterEq {
				quote = ch
				firstGtInQuote = -1
			}
			afterEq = false
		case ch > ' ':
			afterEq = false
		}
	}
	if quote != 0 && firstGtInQuote >= 0 {
		return firstGtInQuote + 1
	}
	return -1
}

// extractImgSrcAndCleanTag 从单个 <img ...> 中提取解码后的 src，并一并清除无引号值后紧跟的异常孤立引号与自闭合 '/' 污染。
func extractImgSrcAndCleanTag(tag string) (rawSrc string, matchStart int, matchEnd int, ok bool) {
	loc := reImgSrcAttr.FindStringSubmatchIndex(tag)
	if len(loc) < 8 {
		return "", 0, 0, false
	}
	matchStart, matchEnd = loc[0], loc[1]
	switch {
	case loc[2] >= 0:
		rawSrc = tag[loc[2]:loc[3]]
	case loc[4] >= 0:
		rawSrc = tag[loc[4]:loc[5]]
	case loc[6] >= 0:
		rawSrc = tag[loc[6]:loc[7]]
		// 兼容 src=https://example.com/a.jpg" />：剔除紧贴无引号 URL 的孤立尾随引号，避免残留空属性破坏 bluemonday 解析
		for matchEnd < len(tag) && (tag[matchEnd] == '"' || tag[matchEnd] == '\'') {
			matchEnd++
		}
		if strings.HasSuffix(rawSrc, "/") && matchEnd < len(tag) && tag[matchEnd] == '>' {
			rawSrc = strings.TrimSuffix(rawSrc, "/")
			matchEnd--
		}
	}
	cleaned := strings.Trim(strings.TrimSpace(html.UnescapeString(rawSrc)), `"'`)
	return cleaned, matchStart, matchEnd, true
}

func replaceAttrSpan(tag string, start, end int, replacement string) string {
	if replacement == "" {
		return tag[:start] + tag[end:]
	}
	return tag[:start] + replacement + tag[end:]
}

// sanitizeRemoteImageURL 统一解码、剥离首尾异常残留引号并严格校验 http/https 外链 URL。
func sanitizeRemoteImageURL(raw string) (string, bool) {
	s := strings.TrimSpace(html.UnescapeString(raw))
	s = strings.Trim(s, `"'`)
	s = strings.TrimSpace(s)
	if s == "" {
		return "", false
	}
	if strings.HasPrefix(s, "//") {
		s = "https:" + s
	}
	if strings.ContainsAny(s, " \t\r\n\"'<>()\\") {
		return "", false
	}
	u, err := url.Parse(s)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return "", false
	}
	return s, true
}
