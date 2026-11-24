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
