package workbuddymail

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"omnimail/internal/apperr"
)

func TestBrowserAuthPollSuccessTimeoutAndCancel(t *testing.T) {
	var pollCount int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v2/plugin/auth/state":
			if r.Header.Get("Authorization") != "" {
				t.Errorf("StartBrowserAuth must not carry Authorization header")
			}
			if got := r.URL.Query().Get("platform"); got != "workbuddy" {
				t.Errorf("expected platform=workbuddy, got %q", got)
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"code": 0,
				"data": map[string]any{
					"state":   "st_test_123",
					"authUrl": "https://www.workbuddy.cn/login?state=st_test_123",
				},
			})
		case "/v2/plugin/auth/token":
			n := atomic.AddInt32(&pollCount, 1)
			if r.URL.Query().Get("state") == "st_timeout" {
				_ = json.NewEncoder(w).Encode(map[string]any{"code": 11217, "msg": "pending"})
				return
			}
			if n < 3 {
				_ = json.NewEncoder(w).Encode(map[string]any{"code": 11217, "msg": "pending"})
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"code": 0,
				"data": map[string]any{
					"accessToken":  "acc_tok_1",
					"refreshToken": "ref_tok_1",
					"expiresIn":    3600,
				},
			})
		case "/v2/plugin/account":
			if r.Header.Get("Authorization") != "Bearer acc_tok_1" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"code": 0,
				"data": map[string]any{
					"uid":          "uid_alpha/01",
					"enterpriseId": "ent_99",
				},
			})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	authCli, err := NewAuthClient(srv.URL, TransportConfig{HTTPClient: srv.Client(), AllowLoopbackHTTP: true})
	if err != nil {
		t.Fatalf("NewAuthClient failed: %v", err)
	}
	authCli.SetPollInterval(15 * time.Millisecond)

	started, err := authCli.StartBrowserAuth(context.Background())
	if err != nil {
		t.Fatalf("StartBrowserAuth failed: %v", err)
	}
	if started.State != "st_test_123" || started.AuthURL == "" {
		t.Fatalf("unexpected start result: %+v", started)
	}

	creds, err := authCli.PollAuthToken(context.Background(), started.State)
	if err != nil {
		t.Fatalf("PollAuthToken failed: %v", err)
	}
	if creds.AccessToken != "acc_tok_1" || creds.RefreshToken != "ref_tok_1" {
		t.Fatalf("unexpected creds: %+v", creds)
	}

	creds, err = authCli.FetchAccountInfo(context.Background(), creds)
	if err != nil {
		t.Fatalf("FetchAccountInfo failed: %v", err)
	}
	if creds.UID != "uid_alpha/01" || creds.EnterpriseID != "ent_99" || creds.TenantID != "ent_99" {
		t.Fatalf("unexpected account info: %+v", creds)
	}

	ctxTimeout, cancelTimeout := context.WithTimeout(context.Background(), 40*time.Millisecond)
	defer cancelTimeout()
	_, err = authCli.PollAuthToken(ctxTimeout, "st_timeout")
	if got := apperr.CodeOf(err); got != apperr.CodeWBAuthTimeout {
		t.Fatalf("expected ERR_WB_AUTH_TIMEOUT, got %q (%v)", got, err)
	}

	ctxCancel, cancelNow := context.WithCancel(context.Background())
	cancelNow()
	_, err = authCli.PollAuthToken(ctxCancel, "st_timeout")
	if got := apperr.CodeOf(err); got != apperr.CodeWBCancelled {
		t.Fatalf("expected ERR_WB_CANCELLED, got %q (%v)", got, err)
	}
}

func TestConcurrent401SingleFlightRefreshAndRetry(t *testing.T) {
	var refreshCalls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v2/plugin/auth/token/refresh":
			atomic.AddInt32(&refreshCalls, 1)
			time.Sleep(35 * time.Millisecond)
			if r.Header.Get("X-Refresh-Token") != "ref_valid" || r.Header.Get("X-Auth-Refresh-Source") != "plugin" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"code": 0,
				"data": map[string]any{
					"accessToken":  "acc_fresh_2",
					"refreshToken": "ref_valid_2",
					"expiresIn":    7200,
				},
			})
		case "/v2/as/connector/agentmail/me":
			if r.Header.Get("X-User-Id") != "user%2F100" {
				t.Errorf("expected URL-escaped X-User-Id, got %q", r.Header.Get("X-User-Id"))
			}
			if r.Header.Get("Authorization") != "Bearer acc_fresh_2" {
				w.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(w).Encode(map[string]any{
					"error": map[string]any{"code": "AUTHENTICATION_REQUIRED"},
				})
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"code": 0,
				"data": map[string]any{"status": "running", "alias": "agent@mail.workbuddy.cn"},
			})
		}
	}))
	defer srv.Close()

	var persistedCount int32
	cli, err := NewClient(TokenCredentials{
		AccessToken:  "acc_expired_1",
		RefreshToken: "ref_valid",
		UID:          "user/100",
		EnterpriseID: "ent_1",
		TenantID:     "ent_1",
		BaseURL:      srv.URL,
	}, TransportConfig{HTTPClient: srv.Client(), AllowLoopbackHTTP: true}, func(next TokenCredentials) error {
		if next.AccessToken == "acc_fresh_2" {
			atomic.AddInt32(&persistedCount, 1)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}

	const workers = 6
	var wg sync.WaitGroup
	errs := make(chan error, workers)
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			st, callErr := cli.GetConnectorStatus(context.Background())
			if callErr != nil {
				errs <- callErr
				return
			}
			if st.Status != StatusRunning {
				t.Errorf("expected running, got %s", st.Status)
			}
		}()
	}
	wg.Wait()
	close(errs)
	for e := range errs {
		t.Fatalf("worker failed after 401 retry: %v", e)
	}
	if got := atomic.LoadInt32(&refreshCalls); got != 1 {
		t.Fatalf("expected singleflight 1 refresh call, got %d", got)
	}
	if got := atomic.LoadInt32(&persistedCount); got != 1 {
		t.Fatalf("expected 1 persisted callback, got %d", got)
	}
}
