package bridge

import (
	"context"
	"errors"

	"omnimail/desktop/internal/domain"
	"omnimail/desktop/internal/service"
)

type MailBridge struct {
	mail *service.Mail
	save func(string, []byte) (bool, error)
}

func NewMailBridge(mail *service.Mail, save func(string, []byte) (bool, error)) *MailBridge {
	return &MailBridge{mail: mail, save: save}
}

func (b *MailBridge) Providers() []domain.ProviderPreset { return domain.ProviderPresets() }

func (b *MailBridge) Accounts(ctx context.Context) ([]service.AccountSummary, error) {
	result, err := b.mail.Accounts(ctx)
	return result, mailError(err)
}

func (b *MailBridge) AddAccount(ctx context.Context, input service.AddAccountInput) (service.AccountSummary, error) {
	result, err := b.mail.AddAccount(ctx, input)
	return result, mailError(err)
}

func (b *MailBridge) Disconnect(ctx context.Context, id string) error {
	return mailError(b.mail.Disconnect(ctx, id))
}

func (b *MailBridge) Messages(ctx context.Context, accountID, folder string, offset int) ([]domain.MailSummary, error) {
	result, err := b.mail.Messages(ctx, accountID, folder, offset)
	return result, mailError(err)
}

func (b *MailBridge) Message(ctx context.Context, id string) (domain.MailDetail, error) {
	result, err := b.mail.Message(ctx, id)
	return result, mailError(err)
}

func (b *MailBridge) RefreshMessage(ctx context.Context, id string) (domain.MailDetail, error) {
	result, err := b.mail.RefreshMessage(ctx, id)
	return result, mailError(err)
}

func (b *MailBridge) SetStarred(ctx context.Context, id string, starred bool) error {
	return mailError(b.mail.SetStarred(ctx, id, starred))
}

func (b *MailBridge) Sync(ctx context.Context, id string) error {
	if id != "" {
		return mailError(b.mail.QueueSync(id))
	}
	accounts, err := b.mail.Accounts(ctx)
	if err != nil {
		return mailError(err)
	}
	for _, account := range accounts {
		if account.Status != domain.AccountConfigured {
			continue
		}
		if err := b.mail.QueueSync(account.ID); err != nil && service.ErrorCode(err) != "BUSY" {
			return mailError(err)
		}
	}
	return nil
}

func (b *MailBridge) Send(ctx context.Context, input service.SendInput) error {
	return mailError(b.mail.Send(ctx, input))
}

func (b *MailBridge) SaveAttachment(ctx context.Context, id string) (bool, error) {
	data, name, err := b.mail.Attachment(ctx, id)
	if err != nil {
		return false, mailError(err)
	}
	if ctx.Err() != nil {
		return false, mailError(ctx.Err())
	}
	saved, err := b.save(name, data)
	if err != nil {
		return false, errors.New("SAVE_FAILED")
	}
	return saved, nil
}

func mailError(err error) error {
	if err == nil {
		return nil
	}
	return errors.New(service.ErrorCode(err))
}
