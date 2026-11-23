package security

import (
	"strings"
	"testing"
)

func TestHTMLSanitizerXSSAndRemoteImageInterception(t *testing.T) {
	raw := `<div>
		<script>alert('xss')</script>
		<iframe src="https://evil.example"></iframe>
		<p onclick="steal()" style="background-image: url('https://tracker.example/pixel.gif')">正文段落</p>
		<img src="https://cdn.example/banner.png" onerror="alert(1)" alt="横幅"/>
		<img src="cid:logo-001@omnimail"/>
		<a href="javascript:alert(2)">危险链接</a>
		<a href="https://docs.example/spec">规范文档</a>
	</div>`

	sanitized, hasRemote := SanitizeMailHTML(raw, map[string]string{"logo-001@omnimail": "att-inline-1"})
	if !hasRemote {
		t.Fatal("应检测到远程追踪图片并标记 hasRemote=true")
	}
	for _, forbidden := range []string{"<script", "<iframe", "onclick", "onerror", "javascript:", ` src="https://cdn.example`, "tracker.example"} {
		if strings.Contains(strings.ToLower(sanitized), strings.ToLower(forbidden)) {
			t.Fatalf("净化结果残留危险或未拦截外链片段 %q: %s", forbidden, sanitized)
		}
	}
	if !strings.Contains(sanitized, `data-omnimail-src="https://cdn.example/banner.png"`) {
		t.Fatalf("外链图片未重写为 data-omnimail-src: %s", sanitized)
	}
	if !strings.Contains(sanitized, `src="/omnimail-cid/att-inline-1"`) {
		t.Fatalf("内嵌 cid 图片未重写为受控本地流: %s", sanitized)
	}

	restored := RestoreRemoteImages(sanitized)
	if !strings.Contains(restored, `src="https://cdn.example/banner.png"`) {
		t.Fatalf("单封放行后应还原外链 src: %s", restored)
	}
}
