package mailnet

import (
	"errors"
	"github.com/emersion/go-imap/v2"
	"omnimail/desktop/internal/domain"
	"testing"
)

func TestRealTLSStarredPreservesSeenAndChecksUIDValidity(t *testing.T) {
	endpoint, transport := imapFixture(t, domain.TLSImplicit)
	opened, err := transport.Connect(t.Context(), endpoint, []byte("test-password"))
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := opened.Close(); err != nil {
			t.Error(err)
		}
	}()
	s, ok := opened.(*session)
	if !ok {
		t.Fatal("测试协议会话类型错误")
	}
	validity, _, err := s.Select("INBOX")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.client.Select("INBOX", &imap.SelectOptions{}).Wait(); err != nil {
		t.Fatal(err)
	}
	if err := s.client.Store(imap.UIDSetNum(1), &imap.StoreFlags{Op: imap.StoreFlagsAdd, Silent: true, Flags: []imap.Flag{imap.FlagSeen}}, nil).Close(); err != nil {
		t.Fatal(err)
	}
	for _, value := range []bool{true, false} {
		if err := s.SetStarred("INBOX", validity, 1, value); err != nil {
			t.Fatal(err)
		}
		rows, err := s.client.Fetch(imap.UIDSetNum(1), &imap.FetchOptions{UID: true, Flags: true}).Collect()
		if err != nil || len(rows) != 1 || !contains(rows[0].Flags, imap.FlagSeen) || contains(rows[0].Flags, imap.FlagFlagged) != value {
			t.Fatal("星标覆盖其他标记或修改失败")
		}
	}
	if err := s.SetStarred("INBOX", validity+1, 1, true); !errors.Is(err, domain.ErrProtocol) {
		t.Fatal("旧代次 UID 可写")
	}
	if err := s.SetStarred("INBOX", validity, 0, true); !errors.Is(err, domain.ErrProtocol) {
		t.Fatal("零 UID 可写")
	}
}
