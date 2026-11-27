package security

import (
	"bytes"
	"encoding/base64"
	"strings"
	"testing"
)

func TestSanitizeMailHTMLCidCaseBracketAndMissing(t *testing.T) {
	raw := `<p><img src="cid:IMG_Hero%40Outlook.COM" alt="hero"><img src="cid:<Second.Img@qq.com>"><img src="cid:missing@example.com"></p>`
	cidMap := map[string]string{
		"<img_hero@outlook.com>": "msg1-att-1",
		"SECOND.IMG@QQ.COM":      "msg1-att-2",
	}
	cleaned, hasRemote := SanitizeMailHTML(raw, cidMap)
	if hasRemote {
		t.Fatalf("纯 cid 图片不应标记 hasRemoteImages")
	}
	if !strings.Contains(cleaned, `src="/omnimail-cid/msg1-att-1"`) || !strings.Contains(cleaned, `data-omnimail-cid="msg1-att-1"`) {
		t.Fatalf("大小写与 URL 转义 cid 未正确命中: %s", cleaned)
	}
	if !strings.Contains(cleaned, `src="/omnimail-cid/msg1-att-2"`) || !strings.Contains(cleaned, `data-omnimail-cid="msg1-att-2"`) {
		t.Fatalf("带尖括号 cid 未正确命中: %s", cleaned)
	}
	if !strings.Contains(cleaned, `data-omnimail-cid-missing="1"`) {
		t.Fatalf("未命中 cid 应保留 data-omnimail-cid-missing 占位属性: %s", cleaned)
	}
}

func TestSanitizeMailHTMLSafeDataImageAndSVGBlock(t *testing.T) {
	tinyPNG := base64.StdEncoding.EncodeToString([]byte{
		0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
	})
	svgPayload := base64.StdEncoding.EncodeToString([]byte(`<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>`))
	hugePayload := base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{0xFF}, maxInlineDataImageBytes+128))

	raw := `<img src="data:image/png;base64,` + tinyPNG + `">` +
		`<img src="data:image/jpg;base64,` + tinyPNG + `">` +
		`<img src="data:image/svg+xml;base64,` + svgPayload + `">` +
		`<img src="data:image/png;base64,` + hugePayload + `">`

	cleaned, _ := SanitizeMailHTML(raw, nil)
	if !strings.Contains(cleaned, "data:image/png;base64,"+tinyPNG) {
		t.Fatalf("安全小体积 data:image/png 应被放行: %s", cleaned)
	}
	if !strings.Contains(cleaned, "data:image/jpeg;base64,"+tinyPNG) {
		t.Fatalf("安全 data:image/jpg 应规范化为 jpeg 并放行: %s", cleaned)
	}
	if strings.Contains(cleaned, "svg+xml") || strings.Contains(cleaned, svgPayload) {
		t.Fatalf("安全红线：绝不可放行 data:image/svg+xml: %s", cleaned)
	}
	if strings.Contains(cleaned, hugePayload[:32]) {
		t.Fatalf("超过 2MB 的 data:image 应被拦截")
	}
}

func TestSanitizeMailHTMLMalformedMissingOpeningQuoteAndLegacyRestore(t *testing.T) {
	const spotifyHero = "https://message-editor.scdn.co/5523037c-6ddb-45f7-9362-fec3a62435ca"

	t.Run("mso_comment_and_missing_opening_quote", func(t *testing.T) {
		raw := `<!--[if mso]><img src=` + spotifyHero + `" /><![endif]--><div><img src="` + spotifyHero + `"></div>`
		cleaned, hasRemote := SanitizeMailHTML(raw, nil)
		if !hasRemote {
			t.Fatalf("应识别外链图片并标记 hasRemote=true")
		}
		if strings.Contains(cleaned, "&#34;") || strings.Contains(cleaned, "&quot;") {
			t.Fatalf("清洗输出不得包含尾随引号污染: %s", cleaned)
		}
		if got := strings.Count(cleaned, "<img"); got != 1 {
			t.Fatalf("MSO 注释剥离后应仅保留 1 张正常图片, got=%d html=%s", got, cleaned)
		}
		wantAttr := `data-omnimail-src="` + spotifyHero + `"`
		if !strings.Contains(cleaned, wantAttr) {
			t.Fatalf("未生成干净的 data-omnimail-src: %s", cleaned)
		}
	})

	t.Run("uncommented_missing_opening_quote_no_cross_tag_swallow", func(t *testing.T) {
		raw := `<img alt="a" src=https://cdn.example.com/hero.jpg" /><img src="https://cdn.example.com/next.jpg">` +
			`<img src=https://cdn.example.com/selfclose.png/>`
		cleaned, hasRemote := SanitizeMailHTML(raw, nil)
		if !hasRemote {
			t.Fatalf("应标记 hasRemote=true")
		}
		if strings.Contains(cleaned, "&#34;") || strings.Contains(cleaned, "&quot;") {
			t.Fatalf("不得将残缺引号写入 data-omnimail-src: %s", cleaned)
		}
		for _, want := range []string{
			`data-omnimail-src="https://cdn.example.com/hero.jpg"`,
			`data-omnimail-src="https://cdn.example.com/next.jpg"`,
			`data-omnimail-src="https://cdn.example.com/selfclose.png"`,
		} {
			if !strings.Contains(cleaned, want) {
				t.Fatalf("缺失预期干净外链属性 %s，实际输出: %s", want, cleaned)
			}
		}
	})

	t.Run("legacy_polluted_db_restore_remote_images", func(t *testing.T) {
		polluted := `<img data-omnimail-src="` + spotifyHero + `&#34;">`
		restored := RestoreRemoteImages(polluted)
		want := `<img src="` + spotifyHero + `">`
		if restored != want {
			t.Fatalf("存量污染 URL 还原结果不符:\ngot:  %s\nwant: %s", restored, want)
		}
	})
}

func TestSanitizeAndRestoreRemoteBackgroundImages(t *testing.T) {
	t.Run("instagram_inline_style_background_block_and_restore", func(t *testing.T) {
		raw := `<table><tr><td style="background:url(https://scontent.cdninstagram.com/v/photo.jpg?a=1&amp;b=2) no-repeat center / cover; width:300px"></td></tr></table>`
		cleaned, hasRemote := SanitizeMailHTML(raw, nil)
		if !hasRemote {
			t.Fatalf("Instagram 内联背景图应标记 hasRemoteImages=true")
		}
		if strings.Contains(strings.ToLower(cleaned), "url(https://") || strings.Contains(strings.ToLower(cleaned), "url(\"https://") {
			t.Fatalf("拦截态不得残留真实 url(https://...): %s", cleaned)
		}
		if !strings.Contains(cleaned, `data-omnimail-bg="`) {
			t.Fatalf("拦截态应暂存 data-omnimail-bg: %s", cleaned)
		}
		restored := RestoreRemoteImages(cleaned)
		if strings.Contains(restored, "data-omnimail-bg") {
			t.Fatalf("放行还原后应移除 data-omnimail-bg: %s", restored)
		}
		wantStyleFrag := `url(&#34;https://scontent.cdninstagram.com/v/photo.jpg?a=1&amp;b=2&#34;) no-repeat center / cover`
		wantRawFrag := `url("https://scontent.cdninstagram.com/v/photo.jpg?a=1&b=2") no-repeat center / cover`
		if !strings.Contains(restored, wantStyleFrag) && !strings.Contains(restored, wantRawFrag) {
			t.Fatalf("放行后未精准还原 Instagram 背景图及 no-repeat center / cover: %s", restored)
		}
	})

	t.Run("style_block_and_html_background_attr_restore", func(t *testing.T) {
		raw := `<style>.ig-hero { background-image: url('//cdn.example.com/banner.webp?x=1'); }</style>` +
			`<table background="https://cdn.example.com/tile.png"><tr><td>Hi</td></tr></table>`
		cleaned, hasRemote := SanitizeMailHTML(raw, nil)
		if !hasRemote {
			t.Fatalf("应标记 hasRemoteImages=true")
		}
		if strings.Contains(strings.ToLower(cleaned), "url(") || strings.Contains(strings.ToLower(cleaned), `background="`) {
			t.Fatalf("拦截态不得残留真实 url(...) 或 background=\"...\": %s", cleaned)
		}
		if !strings.Contains(cleaned, `data-omnimail-bg="https://cdn.example.com/tile.png"`) {
			t.Fatalf("HTML background 属性应暂存至 data-omnimail-bg: %s", cleaned)
		}
		restored := RestoreRemoteImages(cleaned)
		if !strings.Contains(restored, `url("https://cdn.example.com/banner.webp?x=1")`) {
			t.Fatalf("<style> 块远程背景图未正确还原: %s", restored)
		}
		if !strings.Contains(restored, `https://cdn.example.com/tile.png`) || !strings.Contains(restored, "background-image") {
			t.Fatalf("HTML background 属性未还原为安全内联 background-image: %s", restored)
		}
	})

	t.Run("reject_javascript_and_forged_bg_payloads", func(t *testing.T) {
		raw := `<div data-omnimail-bg="javascript:alert(1)" style="background:url(javascript:alert(1))">X</div>`
		cleaned, hasRemote := SanitizeMailHTML(raw, nil)
		if hasRemote {
			t.Fatalf("恶意 javascript: URL 不应标记为合法远程图片")
		}
		if strings.Contains(strings.ToLower(cleaned), "javascript:") || strings.Contains(cleaned, "data-omnimail-bg") {
			t.Fatalf("恶意协议或伪造 data-omnimail-bg 必须彻底清除: %s", cleaned)
		}
		restored := RestoreRemoteImages(`<div data-omnimail-bg="javascript:alert(9)" style="background:none">X</div>`)
		if strings.Contains(strings.ToLower(restored), "javascript:") {
			t.Fatalf("RestoreRemoteImages 绝不能还原非 http/https 协议: %s", restored)
		}
	})
}
