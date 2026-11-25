package accounts

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/mailproto"
	"omnimail/internal/security"
)

func strOrDefault(v, def string) string {
	if s := strings.TrimSpace(v); s != "" {
		return s
	}
	return def
}

func intOrDefault(v, def int) int {
	if v > 0 {
		return v
	}
	return def
}

func Create(db *sql.DB, vault *security.Vault, req ConnectRequest) (EmailAccountDTO, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if !strings.Contains(email, "@") || len(email) > 160 {
		return EmailAccountDTO{}, apperr.New(apperr.CodeInvalidInput, "请输入有效的完整邮箱地址")
	}
	preset := mailproto.PresetByID(req.Provider)
	if req.Provider == "" {
		preset = mailproto.ResolveProviderByEmail(email)
	}
	imapHost := strOrDefault(req.ImapHost, preset.DefaultImapHost)
	imapPort := intOrDefault(req.ImapPort, preset.DefaultImapPort)
	imapSec := strOrDefault(req.ImapSecurity, preset.DefaultImapSecurity)
	smtpHost := strOrDefault(req.SmtpHost, preset.DefaultSmtpHost)
	smtpPort := intOrDefault(req.SmtpPort, preset.DefaultSmtpPort)
	smtpSec := strOrDefault(req.SmtpSecurity, preset.DefaultSmtpSecurity)
	authMode := strOrDefault(req.AuthMode, preset.AuthMode)
	id := strOrDefault(req.ID, fmt.Sprintf("acc-%d", time.Now().UnixMilli()%1_000_000_000))
	localPart := email[:strings.IndexByte(email, '@')]
	name := strOrDefault(req.Name, preset.Name+" · "+localPart)
	shortTag := strOrDefault(req.ShortTag, preset.Name)
	senderName := strOrDefault(req.SenderName, localPart)

	var existingCount int
	_ = db.QueryRow(`SELECT COUNT(1) FROM accounts`).Scan(&existingCount)
	isDef := 0
	if existingCount == 0 {
		isDef = 1
	}

	_, err := db.Exec(`
		INSERT INTO accounts (
			id, name, short_tag, email, username, provider, provider_label, auth_mode,
			status, sender_name, imap_host, imap_port, imap_security, smtp_host, smtp_port,
			smtp_security, cert_fingerprint, imap_idle, offline_window_days, is_default, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'connected', ?, ?, ?, ?, ?, ?, ?, ?, 1, 90, ?, ?)
	`,
		id, name, shortTag, email, strings.TrimSpace(req.Username),
		preset.ID, preset.Name, authMode, senderName,
		imapHost, imapPort, imapSec, smtpHost, smtpPort, smtpSec,
		strings.TrimSpace(req.CertFingerprint), isDef, time.Now().UnixMilli(),
	)
	if err != nil {
		return EmailAccountDTO{}, err
	}

	if authMode != "oauth" && strings.TrimSpace(req.Secret) != "" && vault != nil {
		normSecret := mailproto.NormalizeAccountSecret(preset.ID, email, req.Secret)
		if err := vault.Set(VaultImapPassKey(id), normSecret); err != nil {
			_, _ = db.Exec(`DELETE FROM accounts WHERE id = ?`, id)
			return EmailAccountDTO{}, err
		}
		_ = vault.Set(VaultSmtpPassKey(id), normSecret)
	}
	return GetByID(db, vault, id)
}

func Update(db *sql.DB, vault *security.Vault, req UpdateRequest) (EmailAccountDTO, error) {
	cur, err := GetByID(db, vault, req.ID)
	if err != nil {
		return EmailAccountDTO{}, err
	}
	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		cur.Name = strings.TrimSpace(*req.Name)
	}
	if req.ShortTag != nil && strings.TrimSpace(*req.ShortTag) != "" {
		cur.ShortTag = strings.TrimSpace(*req.ShortTag)
	}
	if req.SenderName != nil {
		cur.SenderName = strings.TrimSpace(*req.SenderName)
	}
	if req.ReplyTo != nil {
		cur.ReplyTo = strings.TrimSpace(*req.ReplyTo)
	}
	if req.Signature != nil {
		cur.Signature = *req.Signature
	}
	if req.Imap != nil {
		cur.Imap = *req.Imap
	}
	if req.Smtp != nil {
		cur.Smtp = *req.Smtp
	}
	if req.CertFingerprint != nil {
		cur.CertFingerprint = strings.TrimSpace(*req.CertFingerprint)
	}
	if req.ImapIdle != nil {
		cur.ImapIdle = *req.ImapIdle
	}
	if req.OfflineWindowDays != nil && (*req.OfflineWindowDays == 30 || *req.OfflineWindowDays == 90 || *req.OfflineWindowDays == 180) {
		cur.OfflineWindowDays = *req.OfflineWindowDays
	}

	idleInt := 0
	if cur.ImapIdle {
		idleInt = 1
	}
	_, err = db.Exec(`
		UPDATE accounts SET name=?, short_tag=?, sender_name=?, reply_to=?, signature=?,
			imap_host=?, imap_port=?, imap_security=?, smtp_host=?, smtp_port=?, smtp_security=?,
			cert_fingerprint=?, imap_idle=?, offline_window_days=?
		WHERE id=?
	`,
		cur.Name, cur.ShortTag, cur.SenderName, cur.ReplyTo, cur.Signature,
		cur.Imap.Host, cur.Imap.Port, cur.Imap.Security,
		cur.Smtp.Host, cur.Smtp.Port, cur.Smtp.Security,
		cur.CertFingerprint, idleInt, cur.OfflineWindowDays, cur.ID,
	)
	if err != nil {
		return EmailAccountDTO{}, err
	}
	if strings.TrimSpace(req.Secret) != "" && vault != nil {
		norm := mailproto.NormalizeAccountSecret(cur.Provider, cur.Email, req.Secret)
		_ = vault.Set(VaultImapPassKey(cur.ID), norm)
		_ = vault.Set(VaultSmtpPassKey(cur.ID), norm)
	}
	if req.IsDefault != nil && *req.IsDefault {
		_ = SetDefault(db, cur.ID)
	}
	return GetByID(db, vault, cur.ID)
}

func SetDefault(db *sql.DB, accountID string) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	if _, err := tx.Exec(`UPDATE accounts SET is_default = 0`); err != nil {
		_ = tx.Rollback()
		return err
	}
	res, err := tx.Exec(`UPDATE accounts SET is_default = 1 WHERE id = ?`, accountID)
	if err != nil {
		_ = tx.Rollback()
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		_ = tx.Rollback()
		return apperr.New(apperr.CodeNotFound, "未找到指定的邮箱账户")
	}
	return tx.Commit()
}

func Remove(db *sql.DB, vault *security.Vault, accountID string) error {
	if vault != nil {
		_ = vault.DeletePrefix("account:" + accountID + ":")
	}
	_, _ = db.Exec(`DELETE FROM messages_fts WHERE message_id IN (SELECT id FROM messages WHERE account_id = ?)`, accountID)
	_, err := db.Exec(`DELETE FROM accounts WHERE id = ?`, accountID)
	return err
}

func UpdateStatus(db *sql.DB, accountID, status, lastErr string, syncedUnixMs int64) {
	cleanErr := strings.TrimSpace(security.RedactSensitive(lastErr))
	if status == "connected" {
		cleanErr = ""
	}
	if syncedUnixMs > 0 {
		_, _ = db.Exec(`UPDATE accounts SET status=?, last_error=?, last_synced_at=? WHERE id=?`,
			status, cleanErr, syncedUnixMs, accountID)
		return
	}
	if status == "syncing" {
		_, _ = db.Exec(`UPDATE accounts SET status=? WHERE id=?`, status, accountID)
		return
	}
	_, _ = db.Exec(`UPDATE accounts SET status=?, last_error=? WHERE id=?`,
		status, cleanErr, accountID)
}
