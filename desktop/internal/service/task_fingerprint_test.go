package service

import (
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestRequirementIdentityDoesNotTrustMessageIDAlone(t *testing.T) {
	mail := domain.TaskMail{MailDetail: domain.MailDetail{MailSummary: domain.MailSummary{ID: "mail_1", AccountID: "account_1", From: "a@example.invalid", To: "me@example.invalid", ReceivedAt: 1}}, MessageID: "same-id"}
	text := domain.TranslatedText{Subject: "same subject", Body: "same body"}
	first, err := requirementFingerprint(mail, text)
	if err != nil {
		t.Fatal(err)
	}
	mail.From = "different@example.invalid"
	second, err := requirementFingerprint(mail, text)
	if err != nil || first == second {
		t.Fatal("同 Message-ID 不同发送者被错误去重")
	}
	mail.From = "a@example.invalid"
	mail.ID = "mail_2"
	mail.Mailbox = "Archive"
	copy, err := requirementFingerprint(mail, text)
	if err != nil || copy != first {
		t.Fatal("同封邮件跨目录副本不能复用收据")
	}
}
