package security

import (
	"encoding/base64"
	"html"
	"regexp"
	"strings"
)

const cssURLPlaceholderPrefix = "none/*omnimail-css-url:"

var (
	reStyleAttr       = regexp.MustCompile(`(?is)\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+))`)
	reHTMLBgAttr      = regexp.MustCompile(`(?is)\bbackground\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+))`)
	reDataOmniBgAttr  = regexp.MustCompile(`(?is)\bdata-omnimail-bg\s*=\s*(?:"([^"]*)"|'([^']*)')`)
	reCSSUrlMarker    = regexp.MustCompile(`none/\*omnimail-css-url:([A-Za-z0-9_-]+)\*/`)
	reBgNoneDeclToken = regexp.MustCompile(`(?i)(\bbackground(?:-image)?\s*:\s*[^;]*?)\bnone\b`)
)

func scanHTMLOpenTags(input string, rewrite func(tag string) string) string {
	var b strings.Builder
	b.Grow(len(input))
	for i, n := 0, len(input); i < n; {
		if input[i] == '<' && i+1 < n && isASCIIAlpha(input[i+1]) {
			if end := findBoundedImgTagEnd(input, i); end > i {
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

func isASCIIAlpha(c byte) bool {
	return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
}

// sanitizeElementRemoteBackgrounds 提取内联 style url(...) 与 HTML background="..." 外链至 data-omnimail-bg，默认置为 none。
func sanitizeElementRemoteBackgrounds(input string) (string, bool) {
	low := strings.ToLower(input)
	if !strings.Contains(low, "url(") && !strings.Contains(low, "background") {
		return input, false
	}
	hasRemote := false
	out := scanHTMLOpenTags(input, func(tag string) string {
		tl := strings.ToLower(tag)
		if !strings.Contains(tl, "url(") && !strings.Contains(tl, "background") {
			return tag
		}
		// 防御外部伪造的预设属性，只保留本轮清洗校验生成的 data-omnimail-bg
		cur := reDataOmniBgAttr.ReplaceAllString(tag, "")
		var savedURLs []string

		if loc := reStyleAttr.FindStringSubmatchIndex(cur); len(loc) >= 8 {
			unescStyle := html.UnescapeString(extractMatchedAttrValue(cur, loc))
			if strings.Contains(strings.ToLower(unescStyle), "url(") {
				rewrittenStyle := reCSSURLToken.ReplaceAllStringFunc(unescStyle, func(tok string) string {
					m := reCSSURLToken.FindStringSubmatch(tok)
					if len(m) == 0 {
						return "none"
					}
					u := strings.TrimSpace(firstNonEmpty(m[1], m[2], m[3]))
					lu := strings.ToLower(u)
					if strings.HasPrefix(lu, "data:") {
						if safe, ok := normalizeSafeRasterDataURI(u); ok {
							return `url("` + safe + `")`
						}
						return "none"
					}
					if strings.HasPrefix(lu, "http://") || strings.HasPrefix(lu, "https://") || strings.HasPrefix(lu, "//") {
						if cleanURL, valid := sanitizeRemoteImageURL(u); valid {
							hasRemote = true
							savedURLs = append(savedURLs, cleanURL)
						}
					}
					return "none"
				})
				cur = replaceAttrSpan(cur, loc[0], loc[1], `style="`+html.EscapeString(rewrittenStyle)+`"`)
			}
		}

		if loc := reHTMLBgAttr.FindStringSubmatchIndex(cur); len(loc) >= 8 {
			rawBg := extractMatchedAttrValue(cur, loc)
			if cleanURL, valid := sanitizeRemoteImageURL(rawBg); valid {
				hasRemote = true
				savedURLs = append(savedURLs, cleanURL)
			}
			cur = replaceAttrSpan(cur, loc[0], loc[1], "")
		}

		if len(savedURLs) == 0 {
			return cur
		}
		return insertAttrBeforeTagClose(cur, `data-omnimail-bg="`+html.EscapeString(strings.Join(savedURLs, "\n"))+`"`)
	})
	return out, hasRemote
}

func extractMatchedAttrValue(tag string, loc []int) string {
	switch {
	case loc[2] >= 0:
		return tag[loc[2]:loc[3]]
	case loc[4] >= 0:
		return tag[loc[4]:loc[5]]
	case loc[6] >= 0:
		return tag[loc[6]:loc[7]]
	default:
		return ""
	}
}

func insertAttrBeforeTagClose(tag, attr string) string {
	if len(tag) < 2 || tag[len(tag)-1] != '>' {
		return tag
	}
	closeIdx := len(tag) - 1
	if closeIdx > 0 && tag[closeIdx-1] == '/' {
		closeIdx--
	}
	return strings.TrimRight(tag[:closeIdx], " \t\r\n") + " " + attr + tag[closeIdx:]
}

func encodeStashedCSSURL(cleanURL string) string {
	return cssURLPlaceholderPrefix + base64.RawURLEncoding.EncodeToString([]byte(cleanURL)) + "*/"
}

func restoreStashedBackgrounds(sanitizedHTML string) string {
	out := sanitizedHTML
	if strings.Contains(out, "omnimail-css-url:") {
		out = reCSSUrlMarker.ReplaceAllStringFunc(out, func(tok string) string {
			m := reCSSUrlMarker.FindStringSubmatch(tok)
			if len(m) != 2 {
				return "none"
			}
			raw, err := base64.RawURLEncoding.DecodeString(m[1])
			if err != nil {
				return "none"
			}
			if cleanURL, ok := sanitizeRemoteImageURL(string(raw)); ok {
				return `url("` + cleanURL + `")`
			}
			return "none"
		})
	}
	if !strings.Contains(out, "data-omnimail-bg=") {
		return out
	}
	return scanHTMLOpenTags(out, func(tag string) string {
		m := reDataOmniBgAttr.FindStringSubmatch(tag)
		if len(m) < 3 {
			return tag
		}
		var validURLs []string
		for _, part := range strings.Split(html.UnescapeString(firstNonEmpty(m[1], m[2])), "\n") {
			if cleanURL, ok := sanitizeRemoteImageURL(part); ok {
				validURLs = append(validURLs, cleanURL)
			}
		}
		cleanedTag := strings.ReplaceAll(reDataOmniBgAttr.ReplaceAllString(tag, ""), "  ", " ")
		if len(validURLs) == 0 {
			return cleanedTag
		}
		if loc := reStyleAttr.FindStringSubmatchIndex(cleanedTag); len(loc) >= 8 {
			unesc := html.UnescapeString(extractMatchedAttrValue(cleanedTag, loc))
			idx := 0
			restored := reBgNoneDeclToken.ReplaceAllStringFunc(unesc, func(seg string) string {
				if idx >= len(validURLs) {
					return seg
				}
				sub := reBgNoneDeclToken.FindStringSubmatch(seg)
				u := validURLs[idx]
				idx++
				return sub[1] + `url("` + u + `")`
			})
			if idx < len(validURLs) {
				sep := "; "
				if trimmed := strings.TrimSpace(restored); trimmed == "" || strings.HasSuffix(trimmed, ";") {
					sep = " "
				}
				restored = strings.TrimSpace(restored) + sep + `background-image: url("` + validURLs[idx] + `")`
			}
			return replaceAttrSpan(cleanedTag, loc[0], loc[1], `style="`+html.EscapeString(strings.TrimSpace(restored))+`"`)
		}
		return insertAttrBeforeTagClose(cleanedTag, `style="`+html.EscapeString(`background-image: url("`+validURLs[0]+`")`)+`"`)
	})
}
