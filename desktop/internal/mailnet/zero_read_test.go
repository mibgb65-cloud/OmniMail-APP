package mailnet

import (
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapserver"
)

type zeroReadServer struct {
	imapserver.Session
	zeroReadOptions
	stores atomic.Int32
}

type zeroReadOptions struct {
	positive, rejected, omitReply bool
	wrongReply, changedAfterStore bool
	wrongFlags, missingPresence   bool
}

func (s *zeroReadServer) Select(name string, options *imap.SelectOptions) (*imap.SelectData, error) {
	data, err := s.Session.Select(name, options)
	if err == nil && !s.positive {
		data.UIDValidity = 0
	}
	return data, err
}

func (s *zeroReadServer) Store(w *imapserver.FetchWriter, set imap.NumSet, flags *imap.StoreFlags, options *imap.StoreOptions) error {
	if len(flags.Flags) != 1 || flags.Flags[0] != imap.FlagSeen {
		return s.Session.Store(w, set, flags, options)
	}
	s.stores.Add(1)
	if s.rejected {
		return &imap.Error{Type: imap.StatusResponseTypeNo, Text: "synthetic rejection"}
	}
	if s.wrongReply {
		// 只报告其他 UID 的变化，不能据此宣称目标已读；随后 FETCH 必须发现目标未变。
		response := w.CreateMessage(1)
		response.WriteUID(2)
		response.WriteFlags(flags.Flags)
		return response.Close()
	}
	copyFlags := *flags
	copyFlags.Silent = s.omitReply || s.wrongFlags
	if err := s.Session.Store(w, set, &copyFlags, options); err != nil {
		return err
	}
	if s.wrongFlags {
		response := w.CreateMessage(1)
		response.WriteUID(1)
		response.WriteFlags([]imap.Flag{imap.FlagFlagged})
		return response.Close()
	}
	return nil
}

func (s *zeroReadServer) Fetch(w *imapserver.FetchWriter, set imap.NumSet, options *imap.FetchOptions) error {
	if s.changedAfterStore && s.stores.Load() > 0 && len(options.BodySection) > 0 {
		response := w.CreateMessage(1)
		response.WriteUID(1)
		response.WriteFlags([]imap.Flag{imap.FlagSeen})
		response.WriteInternalDate(time.Unix(1, 0))
		response.WriteRFC822Size(20)
		response.WriteEnvelope(&imap.Envelope{MessageID: "reused@example.invalid", Subject: "different instance"})
		return response.Close()
	}
	return s.Session.Fetch(w, set, options)
}

func TestZeroReadVerifiesIdentityBeforeAndAfterRealTLSStore(t *testing.T) {
	for _, test := range []struct {
		name      string
		allowed   bool
		options   zeroReadOptions
		tamper    string
		wantError error
		wantStore int32
	}{
		{name: "seen_and_unseen", allowed: true, wantStore: 2},
		{name: "ok_without_flags_then_fetch", allowed: true, options: zeroReadOptions{omitReply: true}, wantStore: 2},
		{name: "other_host", wantError: domain.ErrActionUnsupported},
		{name: "positive_epoch", allowed: true, options: zeroReadOptions{positive: true}, wantError: domain.ErrProtocol},
		{name: "missing_presence", allowed: true, options: zeroReadOptions{missingPresence: true}, wantError: domain.ErrProtocol},
		{name: "no_message_id", allowed: true, tamper: "empty_id", wantError: domain.ErrActionUnsupported},
		{name: "wrong_identity", allowed: true, tamper: "subject", wantError: domain.ErrProtocol},
		{name: "server_no", allowed: true, options: zeroReadOptions{rejected: true}, wantError: domain.ErrProtocol, wantStore: 1},
		{name: "wrong_store_uid", allowed: true, options: zeroReadOptions{wrongReply: true}, wantError: domain.ErrActionUncertain, wantStore: 1},
		{name: "wrong_store_flags", allowed: true, options: zeroReadOptions{wrongFlags: true}, wantError: domain.ErrActionUncertain, wantStore: 1},
		{name: "identity_changed_after_store", allowed: true, options: zeroReadOptions{changedAfterStore: true}, wantError: domain.ErrActionUncertain, wantStore: 1},
	} {
		t.Run(test.name, func(t *testing.T) {
			state := &zeroReadServer{zeroReadOptions: test.options}
			endpoint, transport := imapFixtureWithSession(t, domain.TLSImplicit, nil, func(inner imapserver.Session) imapserver.Session {
				state.Session = inner
				return state
			})
			opened, err := transport.Connect(t.Context(), endpoint, []byte("test-password"))
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() {
				if err := opened.Close(); err != nil {
					t.Error(err)
				}
			})
			concrete, ok := opened.(*session)
			if !ok {
				t.Fatal("不是测试协议会话")
			}
			concrete.selectMetadataFallback = true
			if _, _, err := concrete.Select("INBOX"); err != nil {
				t.Fatal(err)
			}
			rows, err := concrete.Headers(1, 1)
			if err != nil || len(rows) != 1 {
				t.Fatal("缺少合成摘要")
			}
			expected := rows[0]
			if test.tamper == "empty_id" {
				expected.MessageID = ""
			} else if test.tamper == "subject" {
				expected.Subject = "not the same message"
			}
			// 在夹具上先加一个独立标记，已读操作不得以 FLAGS= 覆盖它。
			if err := concrete.client.Store(imap.UIDSetNum(1),
				&imap.StoreFlags{Op: imap.StoreFlagsAdd, Flags: []imap.Flag{imap.FlagFlagged}}, nil).Close(); err != nil {
				t.Fatal(err)
			}
			concrete.selectMetadataFallback = test.allowed
			if test.options.missingPresence {
				concrete.metadata = nil
			}
			writer, ok := opened.(domain.MailVerifiedReadSession)
			if !ok {
				t.Fatal("缺少经核验的 NAVER 已读能力")
			}
			for _, wanted := range []bool{true, false} {
				err := writer.SetReadVerified("INBOX", expected, wanted)
				if test.wantError != nil {
					if !errors.Is(err, test.wantError) {
						t.Fatal("保护性错误分类不正确")
					}
					break
				}
				if err != nil {
					t.Fatal("经身份核验的已读/未读失败")
				}
				actual, err := concrete.Headers(1, 1)
				if err != nil || len(actual) != 1 || actual[0].Read != wanted || !actual[0].Starred {
					t.Fatal("Seen 未确认或覆盖了其他标记")
				}
			}
			if state.stores.Load() != test.wantStore {
				t.Fatal("身份核验失败后仍发送 STORE，或成功路径未实际写入")
			}
		})
	}
}
