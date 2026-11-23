package oauth

import (
	"encoding/base64"
	"testing"
)

func TestParseIDTokenClaimsAndLoopbackLifecycle(t *testing.T) {
	hdr := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"RS256"}`))
	body := base64.RawURLEncoding.EncodeToString([]byte(`{"email":"xinghe@gmail.com","name":"陆星河"}`))
	email, name := parseIDTokenClaims(hdr + "." + body + ".sig")
	if email != "xinghe@gmail.com" || name != "陆星河" {
		t.Fatalf("解析 ID Token 失败: email=%q name=%q", email, name)
	}

	mgr := NewManager()
	res, err := mgr.StartFlow("gmail", "test-public-client-id.apps.googleusercontent.com", func(_ CompletedOAuth, _ error) {})
	if err != nil {
		t.Fatalf("启动本地 PKCE 监听失败: %v", err)
	}
	if res.FlowID == "" || res.AuthURL == "" {
		t.Fatalf("返回授权信息为空: %+v", res)
	}
	if err := mgr.CancelFlow(res.FlowID); err != nil {
		t.Fatalf("取消 OAuth 流程释放端口失败: %v", err)
	}
}
