package service

import (
	"context"

	"omnimail/desktop/internal/domain"
)

func (s *Mail) SetRead(ctx context.Context, id string, read bool) error {
	return s.writeMessage(ctx, id, func(session domain.MailSession, location domain.MailLocation) error {
		writer, ok := session.(domain.MailActionSession)
		if !ok {
			return domain.ErrActionUnsupported
		}
		return writer.SetRead(location.Mailbox, location.UIDValidity, location.UID, read)
	}, func(ctx context.Context) error { return s.store.UpdateMailRead(ctx, id, read) }, false)
}

func (s *Mail) MoveMessage(ctx context.Context, id, folder string) error {
	if folder != "archive" && folder != "deleted" {
		return domain.ErrInvalidAccount
	}
	var destination domain.RemoteMailbox
	var validity, uid uint32
	return s.writeMessage(ctx, id, func(session domain.MailSession, location domain.MailLocation) error {
		writer, ok := session.(domain.MailActionSession)
		if !ok {
			return domain.ErrActionUnsupported
		}
		mailboxes, err := session.Mailboxes()
		if err != nil {
			return err
		}
		count := 0
		for _, box := range mailboxes {
			if box.Kind == folder {
				destination = box
				count++
			}
		}
		// 缺失或存在多个同类特殊文件夹时不猜目标，也不创建服务器文件夹。
		if count != 1 || destination.Name == location.Mailbox {
			return domain.ErrActionUnsupported
		}
		validity, uid, err = writer.MoveMail(location.Mailbox, location.UIDValidity, location.UID, destination.Name)
		return err
	}, func(ctx context.Context) error { return s.store.MoveMail(ctx, id, destination, validity, uid) }, true)
}
