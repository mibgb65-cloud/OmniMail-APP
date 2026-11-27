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

	reSafeClassOrID  = regexp.MustCompile(`^[A-Za-z0-9_\-\s]+$`)
	reDataOmniSrc    = regexp.MustCompile(`(?is)\bdata-omnimail-src\s*=\s*"([^"]*)"`)
	reCssExternalURL = regexp.MustCompile(`(?is)url\s*\(\s*['"]?\s*(?:https?:|//)[^)]*\)`)
	reInlineFixedPos = regexp.MustCompile(`(?i)\bposition\s*:\s*fixed\b`)
	reSafeDataImg    = regexp.MustCompile(`(?i)^data:image/(png|jpeg|jpg|gif|webp);base64,([a-z0-9+/=\r\n\s]+)$`)
)

func getMailPolicy() *bluemonday.Policy {
	sanitizerOnce.Do(func() {
		p := bluemonday.UGCPolicy()
		p.AllowAttrs("class", "id").Matching(reSafeClassOrID).Globally()
		p.AllowAttrs("style", "align", "valign", "width", "height", "bgcolor", "cellpadding", "cellspacing", "border", "data-omnimail-bg").Globally()
		p.AllowAttrs("scope", "colspan", "rowspan", "headers").OnElements("th", "td")
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
	s = strings.Trim(strings.TrimSpace(s), "<>")
	return strings.ToLower(strings.TrimSpace(s))
}

// ExtractHTMLReferencedCIDs 提取 HTML 正文中实际通过 cid: 引用的全部规范化 Content-ID 集合。
func ExtractHTMLReferencedCIDs(rawHTML string) map[string]bool {
	out := make(map[string]bool)
	if strings.TrimSpace(rawHTML) == "" {
		return out
	}
	source := stripHTMLCommentsOutsideStyle(rawHTML)
	_ = scanImgTags(source, func(tag string) string {
		src, _, _, ok := extractImgSrcAndCleanTag(tag)
		if ok && strings.HasPrefix(strings.ToLower(src), "cid:") {
			if key := NormalizeContentID(src[4:]); key != "" {
				out[key] = true
			}
		}
		return tag
	})
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

// SanitizeMailHTML 对入库邮件 HTML 做严格白名单清洗，支持安全 style/class 保留、cid 内嵌图与栅格 data URI。
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
	withoutStyles, cleanCSS, styleRemote := extractAndSanitizeStyleBlocks(rawHTML)
	remoteFound := styleRemote

	rewritten := scanImgTags(withoutStyles, func(tag string) string {
		src, mStart, mEnd, ok := extractImgSrcAndCleanTag(tag)
		if !ok {
			return tag
		}
		lower := strings.ToLower(src)
		if strings.HasPrefix(lower, "/omnimail-cid/") {
			attID := strings.TrimPrefix(src, "/omnimail-cid/")
			if unesc, err := url.PathUnescape(attID); err == nil && unesc != "" {
				attID = unesc
			}
			return replaceAttrSpan(tag, mStart, mEnd, `src="`+html.EscapeString(src)+`" data-omnimail-cid="`+html.EscapeString(attID)+`"`)
		}
		if strings.HasPrefix(lower, "cid:") {
			if attID, hit := normMap[NormalizeContentID(src[4:])]; hit && attID != "" {
				safePath := "/omnimail-cid/" + url.PathEscape(attID)
				return replaceAttrSpan(tag, mStart, mEnd, `src="`+safePath+`" data-omnimail-cid="`+html.EscapeString(attID)+`"`)
			}
			return replaceAttrSpan(tag, mStart, mEnd, `data-omnimail-cid-missing="1"`)
		}
		if strings.HasPrefix(lower, "data:") {
			if safeData, safe := normalizeSafeRasterDataURI(src); safe {
				return replaceAttrSpan(tag, mStart, mEnd, `src="`+safeData+`"`)
			}
			return replaceAttrSpan(tag, mStart, mEnd, "")
		}
		if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") || strings.HasPrefix(lower, "//") {
			if cleanURL, valid := sanitizeRemoteImageURL(src); valid {
				remoteFound = true
				return replaceAttrSpan(tag, mStart, mEnd, `data-omnimail-src="`+html.EscapeString(cleanURL)+`"`)
			}
		}
		return replaceAttrSpan(tag, mStart, mEnd, "")
	})

	var bgRemote bool
	rewritten, bgRemote = sanitizeElementRemoteBackgrounds(rewritten)
	if bgRemote {
		remoteFound = true
	}
	if reCssExternalURL.MatchString(rewritten) {
		remoteFound = true
		rewritten = reCssExternalURL.ReplaceAllString(rewritten, "none")
	}
	rewritten = reInlineFixedPos.ReplaceAllString(rewritten, "position: static")

	cleaned := getMailPolicy().Sanitize(rewritten)
	if cleanCSS != "" {
		cleaned = "<style>" + cleanCSS + "</style>" + cleaned
	}
	return cleaned, remoteFound
}

// RestoreRemoteImages 在全局允许外链或单封邮件放行时，安全地将 data-omnimail-src、data-omnimail-bg 与 CSS 占位还原。
func RestoreRemoteImages(sanitizedHTML string) string {
	out := sanitizedHTML
	if strings.Contains(out, "data-omnimail-src=") {
		out = reDataOmniSrc.ReplaceAllStringFunc(out, func(attr string) string {
			m := reDataOmniSrc.FindStringSubmatch(attr)
			if len(m) < 2 {
				return ""
			}
			cleanURL, ok := sanitizeRemoteImageURL(m[1])
			if !ok {
				return ""
			}
			return `src="` + html.EscapeString(cleanURL) + `"`
		})
	}
	return restoreStashedBackgrounds(out)
}

func PlainTextToHTML(plain string) string {
	if strings.TrimSpace(plain) == "" {
		return ""
	}
	lines := strings.Split(strings.ReplaceAll(html.EscapeString(plain), "\r\n", "\n"), "\n")
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
