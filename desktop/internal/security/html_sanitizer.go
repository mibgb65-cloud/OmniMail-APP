package security

import (
	"html"
	"net/url"
	"regexp"
	"strings"
	"sync"

	"github.com/microcosm-cc/bluemonday"
)

var (
	sanitizerOnce sync.Once
	mailPolicy    *bluemonday.Policy

	reImgTag         = regexp.MustCompile(`(?is)<img\b[^>]*>`)
	reImgSrcAttr     = regexp.MustCompile(`(?is)\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))`)
	reDataOmniSrc    = regexp.MustCompile(`(?is)\bdata-omnimail-src\s*=\s*"([^"]*)"`)
	reCssExternalURL = regexp.MustCompile(`(?is)url\s*\(\s*['"]?\s*(?:https?:|//)[^)]*\)`)
)

func getMailPolicy() *bluemonday.Policy {
	sanitizerOnce.Do(func() {
		p := bluemonday.UGCPolicy()
		p.AllowAttrs("style", "align", "valign", "width", "height", "bgcolor", "cellpadding", "cellspacing", "border").Globally()
		p.AllowAttrs("src", "alt", "title", "width", "height", "data-omnimail-src").OnElements("img")
		p.AllowURLSchemes("http", "https", "mailto", "cid")
		p.AllowRelativeURLs(true)
		p.AddTargetBlankToFullyQualifiedLinks(true)
		p.RequireNoReferrerOnLinks(true)
		mailPolicy = p
	})
	return mailPolicy
}

// SanitizeMailHTML 对入库邮件 HTML 做严格白名单清洗，并将外链图片重写至 data-omnimail-src 阻断追踪像素。
func SanitizeMailHTML(rawHTML string, cidMap map[string]string) (sanitized string, hasRemoteImages bool) {
	if strings.TrimSpace(rawHTML) == "" {
		return "", false
	}
	remoteFound := false

	rewritten := reImgTag.ReplaceAllStringFunc(rawHTML, func(tag string) string {
		m := reImgSrcAttr.FindStringSubmatch(tag)
		if len(m) == 0 {
			return tag
		}
		src := html.UnescapeString(strings.TrimSpace(firstNonEmpty(m[1], m[2], m[3])))
		lower := strings.ToLower(src)
		if strings.HasPrefix(lower, "cid:") {
			cidKey := strings.Trim(strings.TrimSpace(src[4:]), "<>")
			if attID, ok := cidMap[cidKey]; ok && attID != "" {
				safePath := "/omnimail-cid/" + url.PathEscape(attID)
				return reImgSrcAttr.ReplaceAllString(tag, `src="`+safePath+`"`)
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
