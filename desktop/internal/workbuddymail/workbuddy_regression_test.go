package workbuddymail

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/config"
	"omnimail/internal/profilemgr"
	"omnimail/internal/security"
)

func TestActiveConnectorStatusAndEndToEndAuthPollLoop(t *testing.T) {
	if got := NormalizeMailboxStatus("active"); got != StatusRunning {
		t.Fatalf("NormalizeMailboxStatus(active) = %q, want %q", got, StatusRunning)
	}
	if got := NormalizeMailboxStatus("running"); got != StatusRunning {
		t.Fatalf("NormalizeMailboxStatus(running) = %q, want %q", got, StatusRunning)
	}
	if got := NormalizeMailboxStatus("forbidden"); got != StatusBanned {
		t.Fatalf("NormalizeMailboxStatus(forbidden) = %q, want %q", got, StatusBanned)
	}

	var accountPolls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v2/plugin/auth/state":
			if got := r.Header.Get("X-Product"); got != "SaaS" {
				t.Errorf("StartBrowserAuth X-Product = %q, want SaaS", got)
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"code": 0,
				"data": map[string]any{
					"state":   "st_active_e2e",
					"authUrl": "https://www.codebuddy.cn/login?state=st_active_e2e",
				},
			})
		case "/v2/plugin/auth/token":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"code": 0,
				"data": map[string]any{
					"accessToken":  "acc_live_active",
					"refreshToken": "ref_live_active",
					"expiresIn":    3600,
				},
			})
		case "/v2/plugin/account":
			if got := r.Header.Get("X-Product"); got != "SaaS" {
				t.Errorf("FetchAccountInfo X-Product = %q, want SaaS", got)
			}
			// 模拟账号初始化中连续 4 次返回 12151，第 5 次才就绪（原实现只重试 2 次会失败）
			if accountPolls.Add(1) < 5 {
				_ = json.NewEncoder(w).Encode(map[string]any{"code": 12151, "msg": "account pending"})
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"code": 0,
				"data": map[string]any{"uid": "uid_pifz6658", "enterpriseId": "personal"},
			})
		case "/v2/as/connector/agentmail/me":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"code": 0,
				"data": map[string]any{
					"status":   "active",
					"alias":    "pifz6658@agent.qq.com",
					"openedAt": "2026-11-12T00:33:42Z",
					"userType": "personal",
				},
			})
		case "/console/agent-gateway/agentmailrest/v1/me":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data": map[string]any{
					"aliases": []map[string]any{
						{"alias_id": "al_unbound", "email": "unbound@agent.qq.com", "is_primary": false, "status": "not_bound"},
						{"alias_id": "al_other", "email": "secondary@agent.qq.com", "is_primary": true, "status": "active"},
						{"alias_id": "al_pifz", "email": "pifz6658@agent.qq.com", "is_primary": false, "status": "active"},
					},
				},
			})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	mgr := NewManagerWithConfig(TransportConfig{HTTPClient: srv.Client(), AllowLoopbackHTTP: true})
	mgr.pollInterval = 10 * time.Millisecond
	profDir := t.TempDir()
	vault, err := security.OpenVault("wb-test", profDir)
	if err != nil {
		t.Fatal(err)
	}
	sess := &profilemgr.Session{
		Meta:       config.ProfileMeta{ID: "personal"},
		ProfileDir: profDir,
		Vault:      vault,
		Ctx:        context.Background(),
	}

	started, err := mgr.StartAuth(sess, srv.URL)
	if err != nil {
		t.Fatalf("StartAuth failed: %v", err)
	}

	var finalPoll AuthPollResult
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		p, err := mgr.PollAuthStatus(sess, started.FlowID)
		if err != nil {
			t.Fatalf("PollAuthStatus err: %v", err)
		}
		if p.Stage != AuthStagePolling {
			finalPoll = p
			break
		}
		time.Sleep(15 * time.Millisecond)
	}

	if finalPoll.Stage != AuthStageAuthorized {
		t.Fatalf("expected AuthStageAuthorized, got %+v", finalPoll)
	}
	if finalPoll.MailboxStatus != StatusRunning {
		t.Fatalf("expected MailboxStatus=running, got %q", finalPoll.MailboxStatus)
	}
	if finalPoll.Email != "pifz6658@agent.qq.com" || finalPoll.AliasID != "al_pifz" {
		t.Fatalf("expected preferred alias pifz6658@agent.qq.com (al_pifz), got %+v", finalPoll)
	}
	for _, a := range finalPoll.Aliases {
		if a.AliasID == "al_unbound" {
			t.Fatalf("unbound alias must be filtered out: %+v", finalPoll.Aliases)
		}
	}
	if got := accountPolls.Load(); got != 5 {
		t.Fatalf("expected 5 FetchAccountInfo polls for 12151, got %d", got)
	}
}

func TestConnectorStatusErrorsOpenedAtFormatsAndAllowedDomains(t *testing.T) {
	for _, dom := range []string{"www.workbuddy.cn", "copilot.tencent.com", "www.codebuddy.cn", "wb.tencentbuddy.com"} {
		if _, gotDom, err := ResolveBaseURL(dom, false); err != nil || gotDom != dom {
			t.Fatalf("ResolveBaseURL(%q) = %q, %v", dom, gotDom, err)
		}
	}

	mode := "biz_error"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch mode {
		case "biz_error":
			_ = json.NewEncoder(w).Encode(map[string]any{"code": 50012, "msg": "upstream connector busy"})
		case "http_400":
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]any{"code": 40001, "msg": "invalid tenant header"})
		case "iso_opened_at":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"code": 0,
				"data": map[string]any{"status": "active", "alias": "pifz6658@agent.qq.com", "openedAt": "2026-11-12T00:33:42Z"},
			})
		case "rest_404_msg":
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"error": map[string]any{"code": "NOT_FOUND", "message": "Agent mailbox profile not initialized"},
			})
		}
	}))
	defer srv.Close()

	cli, err := NewClient(TokenCredentials{AccessToken: "tok", UID: "u1", BaseURL: srv.URL}, TransportConfig{HTTPClient: srv.Client(), AllowLoopbackHTTP: true}, nil)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := cli.GetConnectorStatus(context.Background()); apperr.CodeOf(err) != apperr.CodeWBGatewayFailed || !strings.Contains(err.Error(), "upstream connector busy") {
		t.Fatalf("non-zero code must return CodeWBGatewayFailed instead of not_bound, got: %v", err)
	}

	mode = "http_400"
	if _, err := cli.GetConnectorStatus(context.Background()); apperr.CodeOf(err) != apperr.CodeWBGatewayFailed {
		t.Fatalf("HTTP 400 must return CodeWBGatewayFailed, got: %v", err)
	}

	mode = "iso_opened_at"
	st, err := cli.GetConnectorStatus(context.Background())
	if err != nil || st.Status != StatusRunning || st.OpenedAt <= 0 {
		t.Fatalf("ISO openedAt + active status parse failed: %+v (%v)", st, err)
	}

	mode = "rest_404_msg"
	if _, _, _, err := cli.GetMeAndAliases(context.Background(), ""); apperr.CodeOf(err) != apperr.CodeNotFound || !strings.Contains(err.Error(), "Agent mailbox profile not initialized") {
		t.Fatalf("expected custom 404 message preserved, got: %v", err)
	}
}
