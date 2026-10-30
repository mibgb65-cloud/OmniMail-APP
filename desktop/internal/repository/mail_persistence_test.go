package repository

import (
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestDownloadedMailSurvivesDatabaseCloseAndReopen(t *testing.T) {
	dir := t.TempDir()
	store, err := Open(t.Context(), dir)
	if err != nil {
		t.Fatal(err)
	}
	account, _ := seedMailbox(t, store)
	list, err := store.PageMail(t.Context(), account.ID, "inbox", 0)
	if err != nil {
		t.Fatal(err)
	}
	body := domain.DecodedMail{Text: "持久正文", HTML: `<p>数据库 HTML<img src="cid:logo@test"></p>`,
		Attachments: []domain.DecodedAttachment{{Filename: "logo.png", MIME: "image/png", ContentID: "logo@test", Data: []byte("persisted bytes")}}}
	if err := store.SaveMailBody(t.Context(), list[0].ID, body); err != nil {
		t.Fatal(err)
	}
	if err := store.UpdateMailStarred(t.Context(), list[0].ID, true); err != nil {
		t.Fatal(err)
	}
	if err := store.Close(); err != nil {
		t.Fatal(err)
	}
	reopened, err := Open(t.Context(), dir)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := reopened.Close(); err != nil {
			t.Error(err)
		}
	}()
	got, err := reopened.ReadMail(t.Context(), list[0].ID)
	if err != nil || got.Body != body.Text || got.RawHTML != body.HTML || got.BodyVersion != 1 || !got.Starred || len(got.Attachments) != 1 || got.Attachments[0].ContentID != "logo@test" {
		t.Fatal("关闭重开丢失数据库正文、星标或图片关联")
	}
	data, name, err := reopened.ReadAttachment(t.Context(), got.Attachments[0].ID)
	if err != nil || string(data) != "persisted bytes" || name != "logo.png" {
		t.Fatal("持久附件无法离线重读")
	}
}
