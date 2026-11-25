package accounts

import (
	"context"
	"database/sql"
	"math"
	"strings"

	"omnimail/internal/apperr"
	"omnimail/internal/mailproto"
	"omnimail/internal/oauth"
	"omnimail/internal/security"
)

func List(db *sql.DB, vault *security.Vault) ([]EmailAccountDTO, error) {
	rows, err := db.Query(`
		SELECT a.id, a.name, a.short_tag, a.email, a.username, a.provider, a.provider_label,
		       a.auth_mode, a.status, a.last_error, a.last_synced_at, a.sender_name, a.reply_to,
		       a.signature, a.imap_host, a.imap_port, a.imap_security, a.smtp_host, a.smtp_port,
		       a.smtp_security, a.cert_fingerprint, a.imap_idle, a.offline_window_days, a.is_default,
		       (SELECT COUNT(1) FROM messages m WHERE m.account_id = a.id AND m.folder = 'inbox' AND m.is_unread = 1),
		       (SELECT COUNT(1) FROM messages m WHERE m.account_id = a.id),
		       (SELECT COALESCE(SUM(m.size_bytes), 0) FROM messages m WHERE m.account_id = a.id),
		       (SELECT COALESCE(SUM(att.size_bytes), 0) FROM attachments att JOIN messages m ON m.id = att.message_id WHERE m.account_id = a.id AND att.status = 'ready')
		FROM accounts a
		ORDER BY a.is_default DESC, a.created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]EmailAccountDTO, 0)
	for rows.Next() {
		var item EmailAccountDTO
		var idleInt, defInt int
		var msgBytes, attBytes int64
		if err := rows.Scan(
			&item.ID, &item.Name, &item.ShortTag, &item.Email, &item.Username,
			&item.Provider, &item.ProviderLabel, &item.AuthMode, &item.Status, &item.LastError,
			&item.LastSyncedUnixMs, &item.SenderName, &item.ReplyTo, &item.Signature,
			&item.Imap.Host, &item.Imap.Port, &item.Imap.Security,
			&item.Smtp.Host, &item.Smtp.Port, &item.Smtp.Security,
			&item.CertFingerprint, &idleInt, &item.OfflineWindowDays, &defInt,
			&item.UnreadCount, &item.IndexedEmails, &msgBytes, &attBytes,
		); err != nil {
			return nil, err
		}
		item.ImapIdle = idleInt != 0
		item.IsDefault = defInt != 0
		if item.Status == "connected" {
			item.LastError = ""
		}
		item.LastSyncedAt = FormatRelativeSyncTime(item.LastSyncedUnixMs)
		item.StorageMb = math.Round((float64(msgBytes)/(1024*1024))*10) / 10
		item.AttachmentCacheMb = math.Round((float64(attBytes)/(1024*1024))*10) / 10
		if vault != nil {
			if item.AuthMode == "oauth" {
				_, item.HasCredential = vault.Get(oauth.VaultOAuthKey(item.ID))
			} else {
				_, item.HasCredential = vault.Get(VaultImapPassKey(item.ID))
			}
		}
		out = append(out, item)
	}
	return out, nil
}

func GetByID(db *sql.DB, vault *security.Vault, accountID string) (EmailAccountDTO, error) {
	list, err := List(db, vault)
	if err != nil {
		return EmailAccountDTO{}, err
	}
	for _, a := range list {
		if a.ID == accountID {
			return a, nil
		}
	}
	return EmailAccountDTO{}, apperr.New(apperr.CodeNotFound, "未找到指定的邮箱账户")
}

// ResolveEndpointConfig 从数据库与 DPAPI Vault 组装协议栈连接参数，绝不暴露给前端。
func ResolveEndpointConfig(
	ctx context.Context,
	db *sql.DB,
	vault *security.Vault,
	tm *oauth.TokenManager,
	accountID string,
) (mailproto.EndpointConfig, EmailAccountDTO, error) {
	dto, err := GetByID(db, vault, accountID)
	if err != nil {
		return mailproto.EndpointConfig{}, EmailAccountDTO{}, err
	}
	cfg := mailproto.EndpointConfig{
		Provider:        dto.Provider,
		Email:           dto.Email,
		Username:        dto.Username,
		AuthMode:        dto.AuthMode,
		ImapHost:        dto.Imap.Host,
		ImapPort:        dto.Imap.Port,
		ImapSecurity:    dto.Imap.Security,
		SmtpHost:        dto.Smtp.Host,
		SmtpPort:        dto.Smtp.Port,
		SmtpSecurity:    dto.Smtp.Security,
		CertFingerprint: dto.CertFingerprint,
	}
	if dto.AuthMode == "oauth" {
		tok, err := tm.GetValidAccessToken(ctx, vault, dto.ID, dto.Provider, "")
		if err != nil {
			return mailproto.EndpointConfig{}, dto, err
		}
		cfg.Secret = tok
		return cfg, dto, nil
	}
	secret, ok := vault.Get(VaultImapPassKey(dto.ID))
	if !ok || strings.TrimSpace(secret) == "" {
		return mailproto.EndpointConfig{}, dto, apperr.New(apperr.CodeAuthExpired, "本地凭据盒未找到该邮箱授权码，请重新填写")
	}
	cfg.Secret = secret
	return cfg, dto, nil
}
