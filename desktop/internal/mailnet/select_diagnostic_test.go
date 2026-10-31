package mailnet

import (
	"errors"
	"testing"

	"omnimail/desktop/internal/domain"

	"github.com/emersion/go-imap/v2"
)

func TestSelectFailureContainsOnlySafeMailboxMetadata(t *testing.T) {
	for _, test := range []struct {
		name, mailbox, response, wantClass, wantResponse string
	}{
		{"container", "[Gmail]", "NONEXISTENT", "gmail_container", "NONEXISTENT"},
		{"system", "[Gmail]/PRIVATE_MAILBOX", "NOPERM", "gmail_system", "NOPERM"},
		{"googlemail", "[Google Mail]/PRIVATE_MAILBOX", "", "gmail_system", "none"},
		{"private", "PRIVATE_MAILBOX", "PRIVATE_RESPONSE", "other", "unknown"},
	} {
		t.Run(test.name, func(t *testing.T) {
			value := &session{ctx: t.Context()}
			err := value.selectError(test.mailbox, &imap.Error{
				Type: imap.StatusResponseTypeNo, Code: imap.ResponseCode(test.response), Text: "PRIVATE_SERVER_RESPONSE",
			})
			if !errors.Is(err, domain.ErrProtocol) || err.Error() != domain.ErrProtocol.Error() {
				t.Fatal("SELECT 拒绝未保留稳定错误")
			}
			var diagnostic interface {
				ResponseCode() string
				MailboxClass() string
			}
			if !errors.As(err, &diagnostic) {
				t.Fatal("SELECT 拒绝缺少安全元数据")
			}
			if diagnostic.ResponseCode() != test.wantResponse || diagnostic.MailboxClass() != test.wantClass {
				t.Fatal("SELECT 元数据分类不正确")
			}
		})
	}
}
