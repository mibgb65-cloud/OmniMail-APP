package workbuddymail

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"omnimail/internal/apperr"
)

func TestMailAPISuiteStatusAliasesSearchDeleteAndAttachments(t *testing.T) {
	modeNotBound := false
	oversizeAttachment := false
	markedRead := false
	deletedWithToken := false

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-DailyQuota-Limit", "100")
		w.Header().Set("X-DailyQuota-Remaining", "87")
		w.Header().Set("X-DailyQuota-Reset", "1764086400")

		switch r.URL.Path {
		case "/v2/as/connector/agentmail/me":
			if modeNotBound {
				_ = json.NewEncoder(w).Encode(map[string]any{"code": 0, "data": map[string]any{"status": "not_bound"}})
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"code": 0,
				"data": map[string]any{"status": "running", "alias": "agent-work@mail.workbuddy.cn"},
			})
		case "/console/agent-gateway/agentmailrest/v1/me":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data": map[string]any{
					"aliases": []map[string]any{
						{"alias_id": "al_sec", "email": "backup@mail.workbuddy.cn", "is_primary": false},
						{"alias_id": "al_pri", "email": "agent-work@mail.workbuddy.cn", "is_primary": true},
					},
				},
			})
		case "/console/agent-gateway/agentmailrest/v1/aliases/al_pri/messages":
			if r.Method == http.MethodGet {
				_ = json.NewEncoder(w).Encode(map[string]any{
					"data": []map[string]any{{
						"message_id": "msg_1",
						"subject":    "季度报告",
						"from":       "alice@example.com",
						"to":         []string{"agent-work@mail.workbuddy.cn"},
						"snippet":    "附件内含纪要",
						"created_at": "2026-11-25T08:00:00Z",
						"is_read":    false,
					}},
					"pagination": map[string]any{"next_cursor": "cur_page_2", "has_more": true},
				})
			}
		case "/console/agent-gateway/agentmailrest/v1/aliases/al_pri/messages/search":
			if r.URL.Query().Get("search_in") != "SEARCH_IN_ALL" || r.URL.Query().Get("q") != "纪要" {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data":       []map[string]any{{"message_id": "msg_1", "subject": "季度报告", "from": "alice@example.com", "is_read": true}},
				"pagination": map[string]any{"next_cursor": "", "has_more": false},
			})
		case "/console/agent-gateway/agentmailrest/v1/aliases/al_pri/messages/msg_1":
			if r.Method == http.MethodGet {
				_ = json.NewEncoder(w).Encode(map[string]any{
					"data": map[string]any{
						"message_id":  "msg_1",
						"subject":     "季度报告",
						"from":        map[string]any{"name": "Alice", "email": "alice@example.com"},
						"to":          []string{"agent-work@mail.workbuddy.cn"},
						"body_format": "HTML",
						"body":        `<p>你好</p><script>alert(1)</script><a href="https://example.com">官网</a>`,
						"is_read":     false,
						"attachments": []map[string]any{
							{"attachment_id": "att_1", "filename": "../../secret.pdf", "size": 11, "content_type": "application/pdf"},
						},
					},
				})
				return
			}
			if r.Method == http.MethodDelete {
				tok := r.URL.Query().Get("confirmation_token")
				if tok == "" {
					w.WriteHeader(http.StatusBadRequest)
					_ = json.NewEncoder(w).Encode(map[string]any{
						"error": map[string]any{
							"code":    "CONFIRMATION_REQUIRED",
							"details": map[string]any{"confirmation_token": "cfm_tok_99"},
						},
					})
					return
				}
				if tok == "cfm_tok_99" {
					deletedWithToken = true
					_ = json.NewEncoder(w).Encode(map[string]any{"data": map[string]any{"message_id": "msg_1"}})
					return
				}
			}
		case "/console/agent-gateway/agentmailrest/v1/aliases/al_pri/messages/msg_1/update":
			var payload map[string]any
			_ = json.NewDecoder(r.Body).Decode(&payload)
			if payload["is_read"] == true {
				markedRead = true
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"updated": true})
		case "/console/agent-gateway/agentmailrest/v1/aliases/al_pri/messages/msg_1/attachments/att_1":
			rawBytes := []byte("hello-world")
			if oversizeAttachment {
				rawBytes = bytes.Repeat([]byte("A"), MaxAttachmentDecodedBytes+64)
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"content":      base64.StdEncoding.EncodeToString(rawBytes),
				"filename":     "..\\..\\report.pdf",
				"content_type": "application/pdf",
			})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	cli, err := NewClient(TokenCredentials{
		AccessToken: "tok_ok",
		UID:         "u_1",
		BaseURL:     srv.URL,
	}, TransportConfig{HTTPClient: srv.Client(), AllowLoopbackHTTP: true}, nil)
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}

	st, err := cli.GetConnectorStatus(context.Background())
	if err != nil || st.Status != StatusRunning {
		t.Fatalf("expected running, got %+v (%v)", st, err)
	}
	modeNotBound = true
	st2, err := cli.GetConnectorStatus(context.Background())
	if err != nil || st2.Status != StatusNotBound {
		t.Fatalf("expected not_bound, got %+v (%v)", st2, err)
	}
	modeNotBound = false

	aliases, pri, quota, err := cli.GetMeAndAliases(context.Background(), "")
	if err != nil || len(aliases) != 2 || pri.AliasID != "al_pri" || !quota.HasQuota || quota.Limit != 100 || quota.Remaining != 87 {
		t.Fatalf("unexpected aliases/quota: pri=%+v quota=%+v err=%v", pri, quota, err)
	}

	list, err := cli.ListMessages(context.Background(), "al_pri", "inbox", "", 50)
	if err != nil || len(list.Items) != 1 || list.NextCursor != "cur_page_2" || !list.HasMore {
		t.Fatalf("ListMessages failed: %+v (%v)", list, err)
	}

	searched, err := cli.SearchMessages(context.Background(), "al_pri", "inbox", "纪要", "", 50)
	if err != nil || len(searched.Items) != 1 {
		t.Fatalf("SearchMessages failed: %+v (%v)", searched, err)
	}

	detail, err := cli.GetMessageDetail(context.Background(), "al_pri", "msg_1")
	if err != nil || detail.BodyFormat != "HTML" || strings.Contains(detail.SanitizedHTML, "<script>") {
		t.Fatalf("GetMessageDetail sanitization failed: %+v (%v)", detail, err)
	}
	if len(detail.Attachments) != 1 || strings.ContainsAny(detail.Attachments[0].Filename, `/\`) {
		t.Fatalf("attachment filename not sanitized: %+v", detail.Attachments)
	}

	if _, err := cli.MarkAsRead(context.Background(), "al_pri", "msg_1"); err != nil || !markedRead {
		t.Fatalf("MarkAsRead failed: marked=%v err=%v", markedRead, err)
	}

	step1, err := cli.DeleteMessage(context.Background(), "al_pri", "msg_1", "")
	if err != nil || !step1.NeedsConfirmation || step1.ConfirmationToken != "cfm_tok_99" {
		t.Fatalf("Delete step1 failed: %+v (%v)", step1, err)
	}
	step2, err := cli.DeleteMessage(context.Background(), "al_pri", "msg_1", step1.ConfirmationToken)
	if err != nil || !step2.Deleted || !deletedWithToken {
		t.Fatalf("Delete step2 failed: %+v (%v)", step2, err)
	}

	att, err := cli.DownloadAttachment(context.Background(), "al_pri", "msg_1", "att_1")
	if err != nil || string(att.Data) != "hello-world" || strings.ContainsAny(att.Filename, `/\`) {
		t.Fatalf("DownloadAttachment failed: %+v (%v)", att, err)
	}

	oversizeAttachment = true
	_, err = cli.DownloadAttachment(context.Background(), "al_pri", "msg_1", "att_1")
	if got := apperr.CodeOf(err); got != apperr.CodeWBAttachmentTooLarge {
		t.Fatalf("expected ERR_WB_ATTACHMENT_TOO_LARGE, got %q (%v)", got, err)
	}
}
