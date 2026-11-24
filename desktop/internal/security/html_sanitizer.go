package security

import (
	"encoding/base64"
	"html"
	"net/url"
	"regexp"
	"strings"
	"sync"

	"github.com/microcosm-cc/bluemonday"
)

const maxInlineDataImageBytes = 2 * 1024 * 1024

var (
	sanitizerOnce sync.Once
	mailPolicy    *bluemonday.Policy

	reImgTag         = regexp.MustCompile(`(?is)<img\b(?:"[^"]*"|'[^']*'|[^>"'])*>`)
	reImgSrcAttr     = regexp.MustCompile(`(?is)\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))`)
	reDataOmniSrc    = regexp.MustCompile(`(?is)\bdata-omnimail-src\s*=\s*"([^"]*)"`)
	reCssExternalURL = regexp.MustCompile(`(?is)url\s*\(\s*['"]?\s*(?:https?:|//)[^)]*\)`)
	reSafeDataImg    = regexp.MustCompile(`(?i)^data:image/(png|jpeg|jpg|gif|webp);base64,([a-z0-9+/=\r\n\s]+)$`)
)

func getMailPolicy() *bluemonday.Policy {
	sanitizerOnce.Do(func() {
		p := bluemonday.UGCPolicy()
		p.AllowAttrs("style", "align", "valign", "width", "height", "bgcolor", "cellpadding", "cellspacing", "border").Globally()
		p.AllowAttrs("src", "alt", "title", "width", "height", "data-omnimail-src", "data-omnimail-cid", "data-omnimail-cid-missing").OnElements("img")
		p.AllowURLSchemes("http", "https", "mailto", "cid")
		p.AllowDataURIImages()
		p.AllowRelativeURLs(true)
		p.AddTargetBlankToFullyQualifiedLinks(true)
		p.RequireNoReferrerOnLinks(true)
		mailPolicy = p
	})
	return mailPolicy
}

// NormalizeContentID 规范化 MIME Content-ID 与 HTML cid: 引用（解码 URL 转义、去除尖括号并转小写）。
func NormalizeContentID(raw string) string {
	s := strings.TrimSpace(raw)
	if unesc, err := url.PathUnescape(s); err == nil {
		s = unesc
	}
	s = strings.TrimSpace(s)
	s = strings.Trim(s, "<>")
	return strings.ToLower(strings.TrimSpace(s))
}

// ExtractHTMLReferencedCIDs 提取 HTML 正文中实际通过 cid: 引用的全部规范化 Content-ID 集合。
func ExtractHTMLReferencedCIDs(rawHTML string) map[string]bool {
	out := make(map[string]bool)
	if strings.TrimSpace(rawHTML) == "" {
		return out
	}
	for _, tag := range reImgTag.FindAllString(rawHTML, -1) {
		m := reImgSrcAttr.FindStringSubmatch(tag)
		if len(m) == 0 {
			continue
		}
		src := html.UnescapeString(strings.TrimSpace(firstNonEmpty(m[1], m[2], m[3])))
		if strings.HasPrefix(strings.ToLower(src), "cid:") {
			if key := NormalizeContentID(src[4:]); key != "" {
				out[key] = true
			}
		}
	}
	return out
}

func normalizeSafeRasterDataURI(raw string) (string, bool) {
	m := reSafeDataImg.FindStringSubmatch(strings.TrimSpace(raw))
	if len(m) != 3 {
		return "", false
	}
	sub := strings.ToLower(m[1])
	if sub == "jpg" {
		sub = "jpeg"
	}
	compact := strings.Map(func(r rune) rune {
		if r == '\r' || r == '\n' || r == ' ' || r == '\t' {
			return -1
		}
		return r
	}, m[2])
	if compact == "" || base64.StdEncoding.DecodedLen(len(compact)) > maxInlineDataImageBytes+64 {
		return "", false
	}
	decoded, err := base64.StdEncoding.DecodeString(compact)
	if err != nil || len(decoded) == 0 || len(decoded) > maxInlineDataImageBytes {
		return "", false
	}
	return "data:image/" + sub + ";base64," + compact, true
}

// SanitizeMailHTML 对入库邮件 HTML 做严格白名单清洗，支持 cid 内嵌图全兼容与安全栅格 data URI 放行。
func SanitizeMailHTML(rawHTML string, cidMap map[string]string) (sanitized string, hasRemoteImages bool) {
	if strings.TrimSpace(rawHTML) == "" {
		return "", false
	}
	normMap := make(map[string]string, len(cidMap))
	for k, v := range cidMap {
		if nk := NormalizeContentID(k); nk != "" && v != "" {
			normMap[nk] = v
		}
	}
	remoteFound := false

	rewritten := reImgTag.ReplaceAllStringFunc(rawHTML, func(tag string) string {
		m := reImgSrcAttr.FindStringSubmatch(tag)
		if len(m) == 0 {
			return tag
		}
		src := html.UnescapeString(strings.TrimSpace(firstNonEmpty(m[1], m[2], m[3])))
		lower := strings.ToLower(src)
		if strings.HasPrefix(lower, "/omnimail-cid/") {
			attID := strings.TrimPrefix(src, "/omnimail-cid/")
			if unesc, err := url.PathUnescape(attID); err == nil && unesc != "" {
				attID = unesc
			}
			return reImgSrcAttr.ReplaceAllString(tag, `src="`+html.EscapeString(src)+`" data-omnimail-cid="`+html.EscapeString(attID)+`"`)
		}
		if strings.HasPrefix(lower, "cid:") {
			cidKey := NormalizeContentID(src[4:])
			if attID, ok := normMap[cidKey]; ok && attID != "" {
				safePath := "/omnimail-cid/" + url.PathEscape(attID)
				return reImgSrcAttr.ReplaceAllString(tag, `src="`+safePath+`" data-omnimail-cid="`+html.EscapeString(attID)+`"`)
			}
			return reImgSrcAttr.ReplaceAllString(tag, `data-omnimail-cid-missing="1"`)
		}
		if strings.HasPrefix(lower, "data:") {
			if safeData, ok := normalizeSafeRasterDataURI(src); ok {
				return reImgSrcAttr.ReplaceAllString(tag, `src="`+safeData+`"`)
			}
			return reImgSrcAttr.ReplaceAllString(tag, "")
		}
		if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") || strings.HasPrefix(lower, "//") {
			remoteFound = true
			if strings.HasPrefix(lower, "//") {
				src = "https:" + src
			}
			escaped := html.EscapeString(src)
			return reImgSrcAttr.ReplaceAllString(tag, `data-omnimail-src="`+escaped+`"`)
		}
		return reImgSrcAttr.ReplaceAllString(tag, "")
	})

	if reCssExternalURL.MatchString(rewritten) {
		remoteFound = true
		rewritten = reCssExternalURL.ReplaceAllString(rewritten, "none")
	}

	cleaned := getMailPolicy().Sanitize(rewritten)
	return cleaned, remoteFound
}

// RestoreRemoteImages 在全局允许外链或单封邮件放行时，安全地将 data-omnimail-src 还原为 src。
func RestoreRemoteImages(sanitizedHTML string) string {
	if !strings.Contains(sanitizedHTML, "data-omnimail-src=") {
		return sanitizedHTML
	}
	return reDataOmniSrc.ReplaceAllStringFunc(sanitizedHTML, func(attr string) string {
		m := reDataOmniSrc.FindStringSubmatch(attr)
		if len(m) < 2 {
			return ""
		}
		raw := html.UnescapeString(m[1])
		u, err := url.Parse(raw)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
			return ""
		}
		return `src="` + html.EscapeString(raw) + `"`
	})
}

func PlainTextToHTML(plain string) string {
	if strings.TrimSpace(plain) == "" {
		return ""
	}
	escaped := html.EscapeString(plain)
	lines := strings.Split(strings.ReplaceAll(escaped, "\r\n", "\n"), "\n")
	return "<p>" + strings.Join(lines, "<br/>") + "</p>"
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}
