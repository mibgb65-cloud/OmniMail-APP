package outbox

import (
	"bytes"
	"encoding/base64"
	"strings"
	"testing"

	"omnimail/internal/accounts"
	"omnimail/internal/mailproto"
)

func TestSaveDraftInlineImageAndSendRelatedMIME(t *testing.T) {
	sess := openTestOutboxSession(t)
	accs, _ := accounts.List(sess.DB, sess.Vault)
	acc := accs[0]

	pngHeader := []byte{
		0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
		0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
	}
	b64 := base64.StdEncoding.EncodeToString(pngHeader)

	// 拒绝非图片 MIME
	if _, err := SaveDraftInlineImage(sess, "d-1", "evil.html", "text/html", base64.StdEncoding.EncodeToString([]byte("<script>alert(1)</script>"))); err == nil {
		t.Fatalf("应拒绝非图片载荷")
	}

	dto, err := SaveDraftInlineImage(sess, "d-1", "paste.png", "image/png", b64)
	if err != nil {
		t.Fatalf("SaveDraftInlineImage failed: %v", err)
	}
	if !strings.HasPrefix(dto.URL, "/omnimail-cid/") || dto.ContentID == "" {
		t.Fatalf("返回内嵌图元数据异常: %+v", dto)
	}

	sched := NewScheduler(nil, nil)
	draft := ComposeDraftState{
		ID:        "d-1",
		Mode:      "new",
		AccountID: acc.ID,
		To:        []string{"receiver@example.com"},
		Subject:   "含内嵌截图的富文本邮件",
		Body:      "请查看截图",
		BodyHTML:  `<p>请查看截图</p><p><img src="` + dto.URL + `" data-cid="` + dto.ContentID + `" /></p>`,
	}
	job, err := sched.SendDraft(sess, SendDraftRequest{
		DraftID:          draft.ID,
		Draft:            &draft,
		BypassUndoWindow: false,
	})
	if err != nil {
		t.Fatalf("SendDraft failed: %v", err)
	}

	var rawSHA string
	if err := sess.DB.QueryRow(`SELECT raw_mime_sha256 FROM outbox_jobs WHERE id = ?`, job.ID).Scan(&rawSHA); err != nil || rawSHA == "" {
		t.Fatalf("查询 outbox raw_mime_sha256 失败: %v", err)
	}
	rawBytes, err := sess.Blobs.GetRawEML(rawSHA)
	if err != nil {
		t.Fatalf("读取 raw eml 失败: %v", err)
	}
	parsed, err := mailproto.ParseRawMessage(rawBytes)
	if err != nil {
		t.Fatalf("ParseRawMessage failed: %v", err)
	}
	if !strings.Contains(parsed.BodyHTML, "cid:"+dto.ContentID) {
		t.Fatalf("发送 MIME 未将内嵌图重写为 cid: %q", parsed.BodyHTML)
	}
	if len(parsed.Attachments) != 1 || !parsed.Attachments[0].IsInline || !bytes.Equal(parsed.Attachments[0].Data, pngHeader) {
		t.Fatalf("发出的内嵌图分部数据不匹配: %+v", parsed.Attachments)
	}
}
