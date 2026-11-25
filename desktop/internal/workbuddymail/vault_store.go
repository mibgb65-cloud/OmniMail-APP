package workbuddymail

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"strings"

	"omnimail/internal/apperr"
	"omnimail/internal/profilemgr"
)

type storedAccount struct {
	AccountID       string               `json:"accountId"`
	WorkspaceID     string               `json:"workspaceId"`
	AccountName     string               `json:"accountName"`
	Email           string               `json:"email"`
	AliasID         string               `json:"aliasId"`
	Aliases         []Alias              `json:"aliases"`
	MailboxStatus   MailboxServiceStatus `json:"mailboxStatus"`
	DailyQuota      DailyQuota           `json:"dailyQuota"`
	LastRefreshedAt int64                `json:"lastRefreshedAt"`
	Credentials     TokenCredentials     `json:"credentials"`
}

func (s storedAccount) toDTO() AccountDTO {
	return AccountDTO{
		AccountID:       s.AccountID,
		WorkspaceID:     s.WorkspaceID,
		AccountName:     s.AccountName,
		Email:           s.Email,
		AliasID:         s.AliasID,
		Aliases:         append([]Alias(nil), s.Aliases...),
		MailboxStatus:   s.MailboxStatus,
		DailyQuota:      s.DailyQuota,
		LastRefreshedAt: s.LastRefreshedAt,
	}
}

func vaultIndexKey(workspaceID string) string {
	return "workbuddy:" + workspaceID + ":index"
}

func vaultRecordKey(workspaceID, accountID string) string {
	return "workbuddy:" + workspaceID + ":account:" + accountID
}

func newOpaqueID(prefix string) string {
	var b [10]byte
	_, _ = rand.Read(b[:])
	return prefix + "_" + hex.EncodeToString(b[:])
}

func readAccountIDIndex(sess *profilemgr.Session) ([]string, error) {
	raw, ok := sess.Vault.Get(vaultIndexKey(sess.Meta.ID))
	if !ok {
		return nil, nil
	}
	var ids []string
	if err := json.Unmarshal([]byte(raw), &ids); err != nil {
		return nil, nil
	}
	return ids, nil
}

func writeAccountIDIndex(sess *profilemgr.Session, ids []string) error {
	if len(ids) == 0 {
		return sess.Vault.Delete(vaultIndexKey(sess.Meta.ID))
	}
	buf, err := json.Marshal(ids)
	if err != nil {
		return err
	}
	return sess.Vault.Set(vaultIndexKey(sess.Meta.ID), string(buf))
}

func listStoredAccounts(sess *profilemgr.Session) ([]storedAccount, error) {
	ids, err := readAccountIDIndex(sess)
	if err != nil || len(ids) == 0 {
		return nil, err
	}
	out := make([]storedAccount, 0, len(ids))
	for _, id := range ids {
		rec, err := loadStoredAccount(sess, id)
		if err == nil && rec.AccountID != "" {
			out = append(out, rec)
		}
	}
	return out, nil
}

func loadStoredAccount(sess *profilemgr.Session, accountID string) (storedAccount, error) {
	trimmed := strings.TrimSpace(accountID)
	if trimmed == "" {
		return storedAccount{}, apperr.New(apperr.CodeNotFound, "未找到指定的 WorkBuddy 账号")
	}
	raw, ok := sess.Vault.Get(vaultRecordKey(sess.Meta.ID, trimmed))
	if !ok {
		return storedAccount{}, apperr.New(apperr.CodeNotFound, "未找到指定的 WorkBuddy 账号")
	}
	var rec storedAccount
	if err := json.Unmarshal([]byte(raw), &rec); err != nil {
		return storedAccount{}, apperr.New(apperr.CodeInternal, "解析本地 WorkBuddy 凭据失败")
	}
	return rec, nil
}

func saveStoredAccount(sess *profilemgr.Session, rec storedAccount) error {
	rec.WorkspaceID = sess.Meta.ID
	buf, err := json.Marshal(rec)
	if err != nil {
		return apperr.New(apperr.CodeInternal, "序列化本地 WorkBuddy 凭据失败")
	}
	if err := sess.Vault.Set(vaultRecordKey(sess.Meta.ID, rec.AccountID), string(buf)); err != nil {
		return apperr.New(apperr.CodeInternal, "写入加密凭据盒失败")
	}
	ids, _ := readAccountIDIndex(sess)
	exists := false
	for _, id := range ids {
		if id == rec.AccountID {
			exists = true
			break
		}
	}
	if !exists {
		ids = append(ids, rec.AccountID)
		if err := writeAccountIDIndex(sess, ids); err != nil {
			return apperr.New(apperr.CodeInternal, "更新 WorkBuddy 凭据索引失败")
		}
	}
	return nil
}

func deleteStoredAccount(sess *profilemgr.Session, accountID string) (storedAccount, error) {
	rec, err := loadStoredAccount(sess, accountID)
	if err != nil {
		return storedAccount{}, err
	}
	_ = sess.Vault.Delete(vaultRecordKey(sess.Meta.ID, rec.AccountID))
	ids, _ := readAccountIDIndex(sess)
	filtered := make([]string, 0, len(ids))
	for _, id := range ids {
		if id != rec.AccountID {
			filtered = append(filtered, id)
		}
	}
	_ = writeAccountIDIndex(sess, filtered)
	return rec, nil
}
