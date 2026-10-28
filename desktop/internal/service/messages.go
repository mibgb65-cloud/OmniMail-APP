package service

import (
	"bytes"
	"context"
	"crypto/rand"
	"fmt"
	"io"
	"mime"
	"mime/quotedprintable"
	"net/mail"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"omnimail/desktop/internal/domain"
)

func (s *Mail) Messages(ctx context.Context, accountID, folder string, offset int) ([]domain.MailSummary, error) {
	return s.store.PageMail(ctx, accountID, folder, offset)
}

func (s *Mail) Message(ctx context.Context, id string) (domain.MailDetail, error) {
	ctx, done, err := s.request(ctx)
	if err != nil {
		return domain.MailDetail{}, err
	}
	defer done()
	detail, err := s.store.ReadMail(ctx, id)
	if err != nil || detail.Cached {
		return detail, err
	}
	location, size, err := s.store.MailLocation(ctx, id)
	if err != nil {
		return detail, err
	}
	if size > 40<<20 {
		return detail, domain.ErrTooLarge
	}
	release, err := s.claim(location.AccountID)
	if err != nil {
		return detail, err
	}
	defer release()
	if err := s.acquire(ctx); err != nil {
		return detail, err
	}
	defer func() { <-s.network }()
	account, err := s.store.GetAccount(ctx, location.AccountID)
	if err != nil {
		return detail, err
	}
	if account.Status == domain.AccountDisconnected {
		return detail, domain.ErrCredentialMissing
	}
	connection, err := endpoint(account, domain.ProtocolIMAP)
	if err != nil {
		return detail, err
	}
	secret, err := s.secrets.Get(ctx, connection.CredentialRef)
	if err != nil {
		return detail, err
	}
	defer clear(secret)
	session, err := s.transport.Connect(ctx, connection, secret)
	if err != nil {
		return detail, err
	}
	defer func() {
		if err := session.Close(); err != nil && ctx.Err() == nil {
			s.log.Warn("关闭正文连接失败", "code", "NETWORK_FAILED")
		}
	}()
	return s.cacheMessage(ctx, id, location, session)
}

func (s *Mail) cacheMessage(ctx context.Context, id string, location domain.MailLocation, session domain.MailSession) (domain.MailDetail, error) {
	var detail domain.MailDetail
	validity, _, err := session.Select(location.Mailbox)
	if err != nil {
		return detail, err
	}
	if validity != location.UIDValidity {
		return detail, domain.ErrProtocol
	}
	hashes := []string{}
	defer func() {
		cleanup, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := s.store.ReleaseCachedAttachments(cleanup, hashes); err != nil {
			s.log.Warn("附件暂存回收失败", "code", "STORAGE_FAILED")
		}
	}()
	body, err := session.Body(location.UID, func(name, kind string, reader io.Reader) (domain.DecodedAttachment, error) {
		attachment, err := s.store.CacheAttachment(ctx, name, kind, reader)
		if err == nil {
			hashes = append(hashes, attachment.Hash)
		}
		return attachment, err
	})
	if err != nil {
		if ctx.Err() != nil {
			return detail, ctx.Err()
		}
		return detail, err
	}
	if err := s.store.SaveMailBody(ctx, id, body); err != nil {
		return detail, err
	}
	return s.store.ReadMail(ctx, id)
}

func (s *Mail) Attachment(ctx context.Context, id string) ([]byte, string, error) {
	return s.store.ReadAttachment(ctx, id)
}

type SendInput struct {
	AccountID string `json:"accountId"`
	To        string `json:"to"`
	Subject   string `json:"subject"`
	Body      string `json:"body"`
}

func buildMessage(account domain.Account, input SendInput) ([]string, []byte, error) {
	if len(input.To) > 8192 || len(input.Subject) > 512 || len(input.Body) > 1<<20 ||
		!utf8.ValidString(input.Subject) || !utf8.ValidString(input.Body) || strings.ContainsFunc(input.To+input.Subject, unicode.IsControl) {
		return nil, nil, domain.ErrInvalidAccount
	}
	recipients, err := mail.ParseAddressList(input.To)
	if err != nil || len(recipients) == 0 || len(recipients) > 50 {
		return nil, nil, domain.ErrInvalidAccount
	}
	addresses, headers := []string{}, []string{}
	for _, recipient := range recipients {
		if len(recipient.Address) > 254 || len(recipient.Name) > 256 {
			return nil, nil, domain.ErrInvalidAccount
		}
		addresses = append(addresses, recipient.Address)
		headers = append(headers, recipient.String())
	}
	var buffer bytes.Buffer
	from := (&mail.Address{Name: account.DisplayName, Address: account.Email}).String()
	fmt.Fprintf(&buffer, "From: %s\r\nTo: %s\r\nSubject: %s\r\nDate: %s\r\nMessage-ID: <%s@omnimail.local>\r\n"+
		"MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n",
		from, strings.Join(headers, ", "), mime.QEncoding.Encode("UTF-8", input.Subject), time.Now().Format(time.RFC1123Z), rand.Text())
	writer := quotedprintable.NewWriter(&buffer)
	if _, err := writer.Write([]byte(input.Body)); err != nil {
		return nil, nil, domain.ErrProtocol
	}
	if err := writer.Close(); err != nil {
		return nil, nil, domain.ErrProtocol
	}
	return addresses, buffer.Bytes(), nil
}

func (s *Mail) Send(ctx context.Context, input SendInput) error {
	if !domain.ValidAccountID(input.AccountID) {
		return domain.ErrInvalidAccount
	}
	ctx, done, err := s.request(ctx)
	if err != nil {
		return err
	}
	defer done()
	release, err := s.claim(input.AccountID)
	if err != nil {
		return err
	}
	defer release()
	account, err := s.store.GetAccount(ctx, input.AccountID)
	if err != nil {
		return err
	}
	if account.Status != domain.AccountConfigured {
		return domain.ErrCredentialMissing
	}
	recipients, message, err := buildMessage(account, input)
	if err != nil {
		return err
	}
	if err := s.acquire(ctx); err != nil {
		return err
	}
	defer func() { <-s.network }()
	connection, err := endpoint(account, domain.ProtocolSMTP)
	if err != nil {
		return err
	}
	secret, err := s.secrets.Get(ctx, connection.CredentialRef)
	if err != nil {
		return err
	}
	defer clear(secret)
	return s.transport.Send(ctx, connection, secret, account.Email, recipients, message)
}
