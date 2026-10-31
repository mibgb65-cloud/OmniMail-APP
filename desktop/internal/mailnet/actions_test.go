package mailnet

import (
	"errors"
	"testing"

	"github.com/emersion/go-imap/v2"
	"omnimail/desktop/internal/domain"
)

func TestReadPreservesStarAndRejectsStaleUID(t *testing.T) {
	endpoint, transport := imapFixture(t, domain.TLSImplicit)
	opened, err := transport.Connect(t.Context(), endpoint, []byte("test-password"))
	if err != nil {
		t.Fatal(err)
	}
	defer opened.Close()
	s := opened.(*session)
	validity, _, err := s.Select("INBOX")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.SetStarred("INBOX", validity, 1, true); err != nil {
		t.Fatal(err)
	}
	observer, err := transport.Connect(t.Context(), endpoint, []byte("test-password"))
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := observer.Close(); err != nil {
			t.Error(err)
		}
	}()
	if _, _, err := observer.Select("INBOX"); err != nil {
		t.Fatal(err)
	}
	for _, read := range []bool{true, false} {
		if err := s.SetRead("INBOX", validity, 1, read); err != nil {
			t.Fatal(err)
		}
		rows, err := s.client.Fetch(imap.UIDSetNum(1), &imap.FetchOptions{UID: true, Flags: true}).Collect()
		if err != nil || len(rows) != 1 || !contains(rows[0].Flags, imap.FlagFlagged) || contains(rows[0].Flags, imap.FlagSeen) != read {
			t.Fatal("已读覆盖星标或写入失败")
		}
		// 独立连接读取服务端状态，证明不是只改客户端显示或同一会话的局部缓存。
		remote, err := observer.Headers(1, 1)
		if err != nil || len(remote) != 1 || remote[0].Read != read {
			t.Fatal("独立 IMAP 客户端看不到已读状态变更", err)
		}
	}
	if err := s.SetRead("INBOX", validity+1, 1, true); !errors.Is(err, domain.ErrProtocol) {
		t.Fatal("允许过期 UID")
	}
	if _, _, err := s.MoveMail("INBOX", validity, 1, "INBOX"); !errors.Is(err, domain.ErrProtocol) {
		t.Fatal("允许原地移动")
	}
	if _, _, err := s.MoveMail("INBOX", validity, 1, "Archive"); !errors.Is(err, domain.ErrActionUnsupported) {
		t.Fatal("无 MOVE 能力却执行危险降级", err)
	}
}

func TestRealTLSMoveKeepsUnrelatedDeletedMail(t *testing.T) {
	caps := imap.CapSet{imap.CapIMAP4rev1: {}, imap.CapUIDPlus: {}, imap.CapMove: {}}
	endpoint, transport := imapFixtureWithCaps(t, domain.TLSImplicit, caps)
	opened, err := transport.Connect(t.Context(), endpoint, []byte("test-password"))
	if err != nil {
		t.Fatal(err)
	}
	defer opened.Close()
	s := opened.(*session)
	if err := s.client.Create("Archive", nil).Wait(); err != nil {
		t.Fatal(err)
	}
	raw := []byte("From: a@example.invalid\r\nSubject: Keep\r\n\r\nkeep")
	appendCommand := s.client.Append("INBOX", int64(len(raw)), &imap.AppendOptions{Flags: []imap.Flag{imap.FlagDeleted}})
	if _, err := appendCommand.Write(raw); err != nil {
		t.Fatal(err)
	}
	if err := appendCommand.Close(); err != nil {
		t.Fatal(err)
	}
	if _, err := appendCommand.Wait(); err != nil {
		t.Fatal(err)
	}
	validity, _, err := s.Select("INBOX")
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := s.MoveMail("INBOX", validity+1, 1, "Archive"); !errors.Is(err, domain.ErrProtocol) {
		t.Fatal("过期移动可写")
	}
	newValidity, newUID, err := s.MoveMail("INBOX", validity, 1, "Archive")
	if err != nil || newValidity == 0 || newUID == 0 {
		t.Fatal("MOVE 未返回有效新位置", err)
	}
	rows, err := s.client.Fetch(imap.UIDSetNum(2), &imap.FetchOptions{UID: true, Flags: true}).Collect()
	if err != nil || len(rows) != 1 || !contains(rows[0].Flags, imap.FlagDeleted) {
		t.Fatal("MOVE 清理了无关已删除邮件", err)
	}
	if _, err := s.client.Select("Archive", nil).Wait(); err != nil {
		t.Fatal(err)
	}
	rows, err = s.client.Fetch(imap.UIDSetNum(imap.UID(newUID)), &imap.FetchOptions{UID: true}).Collect()
	if err != nil || len(rows) != 1 {
		t.Fatal("目标邮件缺失", err)
	}
}
