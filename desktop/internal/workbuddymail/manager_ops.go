package workbuddymail

import (
	"context"
	"strings"
	"time"

	"omnimail/internal/profilemgr"
)

func (m *Manager) GetStatusAndAliases(sess *profilemgr.Session, accountID string) (StatusAndAliasesDTO, error) {
	storedList, err := listStoredAccounts(sess)
	if err != nil {
		return StatusAndAliasesDTO{}, err
	}
	dtos := make([]AccountDTO, 0, len(storedList))
	for _, item := range storedList {
		dtos = append(dtos, item.toDTO())
	}
	if len(storedList) == 0 {
		return StatusAndAliasesDTO{Accounts: []AccountDTO{}}, nil
	}

	targetIdx := 0
	if trimmed := strings.TrimSpace(accountID); trimmed != "" {
		for i, item := range storedList {
			if item.AccountID == trimmed {
				targetIdx = i
				break
			}
		}
	}
	rec := storedList[targetIdx]
	cli, _, err := m.clientForAccount(sess, rec.AccountID)
	if err != nil {
		active := rec.toDTO()
		return StatusAndAliasesDTO{
			Accounts:       dtos,
			ActiveAccount:  &active,
			MailboxStatus:  rec.MailboxStatus,
			Aliases:        rec.Aliases,
			PrimaryAliasID: rec.AliasID,
			PrimaryEmail:   rec.Email,
			DailyQuota:     rec.DailyQuota,
		}, nil
	}

	reqCtx, cancel := context.WithTimeout(sess.Ctx, 15*time.Second)
	defer cancel()
	connState, err := cli.GetConnectorStatus(reqCtx)
	if err != nil {
		active := rec.toDTO()
		return StatusAndAliasesDTO{
			Accounts:       dtos,
			ActiveAccount:  &active,
			MailboxStatus:  rec.MailboxStatus,
			Aliases:        rec.Aliases,
			PrimaryAliasID: rec.AliasID,
			PrimaryEmail:   rec.Email,
			DailyQuota:     rec.DailyQuota,
		}, err
	}
	rec.MailboxStatus = connState.Status
	if connState.Status == StatusRunning || connState.Status == StatusDeactivated {
		aliases, primary, quota, aliasErr := cli.GetMeAndAliases(reqCtx, firstNonEmpty(rec.Email, connState.Alias))
		if aliasErr == nil {
			rec.Aliases = aliases
			rec.AliasID = primary.AliasID
			rec.Email = primary.Email
			if quota.HasQuota {
				rec.DailyQuota = quota
			}
		}
	}
	rec.Credentials = cli.Credentials()
	rec.LastRefreshedAt = time.Now().UnixMilli()
	_ = saveStoredAccount(sess, rec)
	dtos[targetIdx] = rec.toDTO()
	active := dtos[targetIdx]
	return StatusAndAliasesDTO{
		Accounts:       dtos,
		ActiveAccount:  &active,
		MailboxStatus:  rec.MailboxStatus,
		Aliases:        rec.Aliases,
		PrimaryAliasID: rec.AliasID,
		PrimaryEmail:   rec.Email,
		DailyQuota:     rec.DailyQuota,
	}, nil
}

func (m *Manager) ListMessages(sess *profilemgr.Session, accountID, aliasID, dir, cursor string, limit int) (MessageListDTO, error) {
	cli, resolvedAlias, err := m.clientAndAlias(sess, accountID, aliasID)
	if err != nil {
		return MessageListDTO{}, err
	}
	ctx, cancel := context.WithTimeout(sess.Ctx, 20*time.Second)
	defer cancel()
	out, err := cli.ListMessages(ctx, resolvedAlias, dir, cursor, limit)
	if err == nil {
		m.touchAccountQuota(sess, accountID, out.DailyQuota)
	}
	return out, err
}

func (m *Manager) SearchMessages(sess *profilemgr.Session, accountID, aliasID, dir, query, cursor string, limit int) (MessageListDTO, error) {
	cli, resolvedAlias, err := m.clientAndAlias(sess, accountID, aliasID)
	if err != nil {
		return MessageListDTO{}, err
	}
	ctx, cancel := context.WithTimeout(sess.Ctx, 20*time.Second)
	defer cancel()
	out, err := cli.SearchMessages(ctx, resolvedAlias, dir, query, cursor, limit)
	if err == nil {
		m.touchAccountQuota(sess, accountID, out.DailyQuota)
	}
	return out, err
}

func (m *Manager) GetMessageDetail(sess *profilemgr.Session, accountID, aliasID, messageID string) (MessageDetailDTO, error) {
	cli, resolvedAlias, err := m.clientAndAlias(sess, accountID, aliasID)
	if err != nil {
		return MessageDetailDTO{}, err
	}
	ctx, cancel := context.WithTimeout(sess.Ctx, 20*time.Second)
	defer cancel()
	out, err := cli.GetMessageDetail(ctx, resolvedAlias, messageID)
	if err == nil {
		m.touchAccountQuota(sess, accountID, out.DailyQuota)
	}
	return out, err
}

func (m *Manager) MarkAsRead(sess *profilemgr.Session, accountID, aliasID, messageID string) error {
	cli, resolvedAlias, err := m.clientAndAlias(sess, accountID, aliasID)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(sess.Ctx, 12*time.Second)
	defer cancel()
	quota, err := cli.MarkAsRead(ctx, resolvedAlias, messageID)
	if err == nil {
		m.touchAccountQuota(sess, accountID, quota)
	}
	return err
}

func (m *Manager) DeleteMessage(sess *profilemgr.Session, accountID, aliasID, messageID, confirmationToken string) (DeleteResultDTO, error) {
	cli, resolvedAlias, err := m.clientAndAlias(sess, accountID, aliasID)
	if err != nil {
		return DeleteResultDTO{}, err
	}
	ctx, cancel := context.WithTimeout(sess.Ctx, 15*time.Second)
	defer cancel()
	out, err := cli.DeleteMessage(ctx, resolvedAlias, messageID, confirmationToken)
	if err == nil {
		m.touchAccountQuota(sess, accountID, out.DailyQuota)
	}
	return out, err
}

func (m *Manager) DownloadAttachment(sess *profilemgr.Session, accountID, aliasID, messageID, attachmentID string) (DecodedAttachment, error) {
	cli, resolvedAlias, err := m.clientAndAlias(sess, accountID, aliasID)
	if err != nil {
		return DecodedAttachment{}, err
	}
	ctx, cancel := context.WithTimeout(sess.Ctx, 45*time.Second)
	defer cancel()
	out, err := cli.DownloadAttachment(ctx, resolvedAlias, messageID, attachmentID)
	if err == nil {
		m.touchAccountQuota(sess, accountID, out.DailyQuota)
	}
	return out, err
}
