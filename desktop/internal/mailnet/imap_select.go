package mailnet

import (
	"errors"
	"strings"

	"github.com/emersion/go-imap/v2"
)

func (s *session) selectError(name string, err error) error {
	classified := s.commandError(err)
	var failure *protocolFailure
	if !errors.As(classified, &failure) {
		return classified
	}
	return &protocolFailure{
		reason: failure.reason, responseCode: failure.responseCode, mailboxClass: mailboxClass(name),
	}
}

func mailboxClass(name string) string {
	if isGmailContainer(name) {
		return "gmail_container"
	}
	if strings.HasPrefix(name, "[Gmail]/") || strings.HasPrefix(name, "[Google Mail]/") {
		return "gmail_system"
	}
	if strings.EqualFold(name, "INBOX") {
		return "inbox"
	}
	return "other"
}

func isGmailContainer(name string) bool {
	return name == "[Gmail]" || name == "[Google Mail]"
}

func safeIMAPResponseCode(code imap.ResponseCode) string {
	switch code {
	case "":
		return "none"
	case imap.ResponseCodeNonExistent, imap.ResponseCodeNoPerm, imap.ResponseCodeCannot,
		imap.ResponseCodeLimit, imap.ResponseCodeInUse, imap.ResponseCodeServerBug,
		imap.ResponseCodeClientBug, imap.ResponseCodeTryCreate:
		return string(code)
	default:
		return "unknown"
	}
}
