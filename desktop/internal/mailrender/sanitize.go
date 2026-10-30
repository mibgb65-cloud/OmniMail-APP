// Package mailrender 负责不可信邮件的静态呈现，不依赖桌面框架，也不发起网络请求。
package mailrender

import (
	"bytes"
	"encoding/base64"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"net"
	"net/url"
	"regexp"
	"strings"
	"unicode"

	"github.com/microcosm-cc/bluemonday"
	_ "golang.org/x/image/webp"
	"golang.org/x/net/html"
)

const MaxImageBytes = 4 << 20

var policy = newPolicy()

func newPolicy() *bluemonday.Policy {
	p := bluemonday.NewPolicy()
	p.AllowElements(strings.Fields("div p span a img table caption colgroup col thead tbody tfoot tr td th ul ol li blockquote pre code h1 h2 h3 h4 h5 h6 hr br b i u s strong em small font center sup sub")...)
	p.AllowAttrs("style", "title", "alt").Globally()
	p.AllowAttrs("dir").Matching(regexp.MustCompile(`(?i)^(rtl|ltr|auto)$`)).Globally()
	p.AllowAttrs("width", "height", "colspan", "rowspan", "cellpadding", "cellspacing", "border", "span").
		Matching(regexp.MustCompile(`^[0-9]{1,4}%?$`)).Globally()
	p.AllowAttrs("align", "valign").Matching(regexp.MustCompile(`(?i)^(left|right|center|justify|top|middle|bottom)$`)).Globally()
	p.AllowAttrs("color", "bgcolor").Matching(regexp.MustCompile(`(?i)^(#[0-9a-f]{3,8}|[a-z]{1,20})$`)).Globally()
	p.AllowAttrs("href").OnElements("a")
	p.AllowAttrs("src").OnElements("img")
	p.RequireParseableURLs(true)
	p.AllowURLSchemes("http", "https", "mailto", "cid", "data")
	p.AllowRelativeURLs(false)
	// 仅启用库中已有值校验器的静态属性，禁止定位、外部资源、CSS 变量和自定义属性。
	p.AllowStyles(strings.Fields("color background-color font-size font-weight font-family font-style text-align text-decoration padding padding-top padding-right padding-bottom padding-left margin margin-top margin-right margin-bottom margin-left width max-width height border border-width border-color border-style border-collapse vertical-align line-height white-space")...).Globally()
	return p
}

func ImageData(data []byte) string {
	if len(data) == 0 || len(data) > MaxImageBytes {
		return ""
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width <= 0 || config.Height <= 0 || config.Width > 8192 || config.Height > 8192 ||
		int64(config.Width)*int64(config.Height) > 16_000_000 {
		return ""
	}
	mime := map[string]string{"png": "image/png", "jpeg": "image/jpeg", "gif": "image/gif", "webp": "image/webp"}[format]
	if mime == "" {
		return ""
	}
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data)
}

// SafeURL 不允许凭据、控制字符或本地图片探测；不使用后端代理，避免引入 SSRF。
func SafeURL(value string, imageURL bool) string {
	if len(value) > 4096 || strings.ContainsFunc(value, unicode.IsControl) {
		return ""
	}
	if strings.HasPrefix(value, "//") {
		value = "https:" + value
	}
	u, err := url.Parse(value)
	if err != nil || u.User != nil {
		return ""
	}
	if !imageURL && strings.EqualFold(u.Scheme, "mailto") && u.Opaque != "" {
		return u.String()
	}
	if u.Scheme != "https" && u.Scheme != "http" || u.Hostname() == "" {
		return ""
	}
	if imageURL {
		host := strings.TrimSuffix(strings.ToLower(u.Hostname()), ".")
		ip := net.ParseIP(host)
		if host == "localhost" || strings.HasSuffix(host, ".localhost") || strings.HasSuffix(host, ".local") ||
			(ip != nil && (ip.IsPrivate() || ip.IsLoopback() || ip.IsUnspecified() || ip.IsLinkLocalUnicast() || ip.IsMulticast())) {
			return ""
		}
	}
	return u.String()
}

// Sanitize 的输出不会主动加载任何资源；只有清洗完成后才生成受控数据属性，原文同名属性已被剥离。
func Sanitize(source string, resolveCID func(string) string) string {
	if len(source) > 1<<20 || strings.TrimSpace(source) == "" {
		return ""
	}
	cleaned := policy.Sanitize(source)
	if strings.TrimSpace(cleaned) == "" {
		return ""
	}
	doc, err := html.Parse(strings.NewReader(cleaned))
	if err != nil {
		return ""
	}
	var walk func(*html.Node)
	resourceBytes, imageCount := 0, 0
	var pixels int64
	walk = func(node *html.Node) {
		if node.Type == html.ElementNode {
			attrs := make([]html.Attribute, 0, len(node.Attr))
			for _, attr := range node.Attr {
				if node.Data == "img" && attr.Key == "src" {
					src, remote := imageSource(attr.Val, resolveCID)
					imageCount++
					resourceBytes += len(src)
					if imageCount > 128 || resourceBytes > 12<<20 {
						src = ""
					}
					if src != "" && !remote {
						pixels += imagePixels(src)
						if pixels > 16_000_000 {
							src = ""
						}
					}
					if src != "" {
						key := "data-mail-image"
						if remote {
							key = "data-mail-remote"
						}
						attrs = append(attrs, html.Attribute{Key: key, Val: src})
					}
				} else if node.Data == "a" && attr.Key == "href" {
					if target := SafeURL(attr.Val, false); target != "" {
						attrs = append(attrs, html.Attribute{Key: "href", Val: "#omnimail-link"},
							html.Attribute{Key: "data-mail-url", Val: target}, html.Attribute{Key: "title", Val: target})
					}
				} else {
					attrs = append(attrs, attr)
				}
			}
			node.Attr = attrs
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(doc)
	var output bytes.Buffer
	_ = html.Render(&output, doc)
	return output.String()
}

func imagePixels(source string) int64 {
	parts := strings.SplitN(source, ";base64,", 2)
	if len(parts) != 2 {
		return 0
	}
	data, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return 0
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return 0
	}
	return int64(config.Width) * int64(config.Height)
}

func imageSource(src string, resolveCID func(string) string) (string, bool) {
	if strings.HasPrefix(strings.ToLower(src), "cid:") && resolveCID != nil {
		cid, err := url.PathUnescape(src[4:])
		if err == nil && len(cid) <= 998 {
			return resolveCID(cid), false
		}
	}
	if strings.HasPrefix(src, "data:image/") {
		parts := strings.SplitN(src, ";base64,", 2)
		if len(parts) == 2 && len(parts[1]) <= base64.StdEncoding.EncodedLen(MaxImageBytes) {
			data, err := base64.StdEncoding.DecodeString(parts[1])
			if err == nil {
				return ImageData(data), false
			}
		}
	}
	return SafeURL(src, true), true
}
