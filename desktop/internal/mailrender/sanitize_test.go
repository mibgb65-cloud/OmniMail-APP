package mailrender

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"strings"
	"testing"
)

func TestSanitizePreservesLayoutButMakesResourcesInert(t *testing.T) {
	source := `<table style="border-collapse:collapse;width:100%"><tr><td style="color:#123456;padding:12px">
		正文<img src="cid:logo@test" alt="Logo"><img src="https://images.example.invalid/a.png">
		<a href="https://example.invalid/path">链接</a></td></tr></table>`
	got := Sanitize(source, func(cid string) string {
		if cid != "logo@test" {
			t.Fatal("CID 未按原值传递")
		}
		return fixtureImage()
	})
	for _, text := range []string{"<table", "padding", "正文", "data-mail-image=", "data-mail-remote=", `data-mail-url="https://example.invalid/path"`} {
		if !strings.Contains(got, text) {
			t.Fatalf("安全内容丢失：%s", text)
		}
	}
	if strings.Contains(got, " src=") || strings.Contains(got, `href="https:`) {
		t.Fatal("资源在授权前可主动请求")
	}
}

func TestSanitizeRejectsActiveContentAndUnsafeURLs(t *testing.T) {
	source := `<script>alert(1)</script><iframe src="https://evil.invalid"></iframe>
		<form action="https://evil.invalid"><input></form><svg onload="alert(1)"></svg>
		<img src="data:image/svg+xml;base64,PHN2Zz4=" onerror="alert(1)" srcset="https://evil.invalid">
		<a href="javascript:alert(1)">危险</a><base href="https://evil.invalid">
		<div style="background-image:url(https://evil.invalid);position:fixed;left:0;behavior:url(x);color:red">文本</div>
		<img src="http://127.0.0.1/private"><img src="file:///etc/passwd"><img src="https://name:secret@example.invalid/a">
		<img data-mail-remote="https://forged.invalid/a" src="cid:missing">`
	got := Sanitize(source, nil)
	for _, bad := range []string{"<script", "<iframe", "<form", "<input", "<svg", "onerror", "srcset", "<base",
		"javascript:", "background-image", "position", "behavior", "127.0.0.1", "file:", "secret", "forged.invalid"} {
		if strings.Contains(got, bad) {
			t.Errorf("未移除危险内容：%s", bad)
		}
	}
	if !strings.Contains(got, "文本") {
		t.Fatal("安全正文丢失")
	}
}

func TestImageDataChecksActualFormatAndDimensions(t *testing.T) {
	valid := fixtureImage()
	if !strings.HasPrefix(valid, "data:image/png;base64,") {
		t.Fatal("有效 PNG 被拒绝")
	}
	if ImageData([]byte("<svg/>")) != "" {
		t.Fatal("接受了 SVG")
	}
	if ImageData(bytes.Repeat([]byte("x"), MaxImageBytes+1)) != "" {
		t.Fatal("图片预算失效")
	}
}

func TestEmptyHTMLKeepsPlainTextFallback(t *testing.T) {
	if Sanitize("", nil) != "" || Sanitize(" \n ", nil) != "" {
		t.Fatal("纯文本邮件被空白 HTML 文档遮盖")
	}
}

func TestEmbeddedImagesHaveAggregatePixelBudget(t *testing.T) {
	var data bytes.Buffer
	_ = png.Encode(&data, image.NewGray(image.Rect(0, 0, 2000, 2000)))
	src := ImageData(data.Bytes())
	got := Sanitize(strings.Repeat(`<img src="cid:large@test">`, 5), func(string) string { return src })
	if strings.Count(got, "data-mail-image=") != 4 {
		t.Fatal("多张压缩图片绕过总像素预算")
	}
}

func fixtureImage() string {
	var data bytes.Buffer
	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	img.Set(0, 0, color.White)
	_ = png.Encode(&data, img)
	return ImageData(data.Bytes())
}
