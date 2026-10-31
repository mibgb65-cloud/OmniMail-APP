package mailnet

import (
	"errors"
	"strings"
	"unicode"
	"unicode/utf8"

	"omnimail/desktop/internal/domain"

	"github.com/emersion/go-imap/v2"
)

func (s *session) SetReadVerified(mailbox string, expected domain.RemoteMessage, read bool) error {
	if !s.selectMetadataFallback || expected.MessageID == "" {
		return domain.ErrActionUnsupported
	}
	if !validReadIdentity(mailbox, expected) {
		return domain.ErrProtocol
	}
	if err := s.selectZeroForRead(mailbox); err != nil {
		return err
	}
	current, err := s.readIdentity(expected)
	if err != nil {
		return err // 尚未发出 STORE，身份未知或变化绝不写入。
	}
	if err := s.storeFlag(current.UID, imap.FlagSeen, read, true); err != nil {
		var rejected *protocolFailure
		if (errors.As(err, &rejected) && (rejected.reason == "command_no" || rejected.reason == "command_bad")) ||
			errors.Is(err, domain.ErrAuthentication) {
			return err
		}
		return domain.ErrActionUncertain
	}
	current, err = s.readIdentity(expected)
	if err != nil || current.Read != read {
		// 已经发出写入，不能把断线、错误回执或 UID 重用说成“未执行”并自动重试。
		return domain.ErrActionUncertain
	}
	return nil
}

func (s *session) selectZeroForRead(mailbox string) error {
	s.zeroValidity = false
	selected, err := s.selectObserved(mailbox, &imap.SelectOptions{})
	if err != nil {
		return s.selectError(mailbox, err)
	}
	if selected.UIDValidity != 0 || !s.selection.present || s.selection.invalid || s.selection.value != 0 {
		return domain.ErrProtocol
	}
	s.zeroValidity, s.uids, s.searched = true, nil, false
	return nil
}

func (s *session) readIdentity(expected domain.RemoteMessage) (domain.RemoteMessage, error) {
	rows, err := s.Headers(expected.UID, expected.UID)
	if err != nil {
		return domain.RemoteMessage{}, err
	}
	if len(rows) != 1 || !expected.SameIdentity(rows[0]) {
		return domain.RemoteMessage{}, domain.ErrProtocol
	}
	return rows[0], nil
}

func validReadIdentity(mailbox string, expected domain.RemoteMessage) bool {
	if expected.UID == 0 || expected.Size == 0 || expected.ReceivedAt <= 0 ||
		len(mailbox) == 0 || len(mailbox) > 1024 || len(expected.MessageID) > 998 ||
		!strings.Contains(expected.MessageID, "@") || strings.ContainsAny(expected.MessageID, " <>\t\r\n") {
		return false
	}
	for _, value := range []string{mailbox, expected.MessageID, expected.Subject, expected.From, expected.To} {
		if len(value) > 4096 || !utf8.ValidString(value) || strings.ContainsFunc(value, unicode.IsControl) {
			return false
		}
	}
	return true
}
