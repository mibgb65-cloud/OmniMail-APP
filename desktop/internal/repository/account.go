package repository

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"slices"
	"sort"
	"time"

	"omnimail/desktop/internal/domain"

	"modernc.org/sqlite"
)

var _ domain.AccountRepository = (*Store)(nil)

func (s *Store) CreateAccount(ctx context.Context, account domain.Account) (result domain.Account, err error) {
	account.Endpoints = slices.Clone(account.Endpoints)
	if account.ID == "" {
		account.ID = rand.Text()
	}
	now := time.Now().UnixMilli()
	account.CreatedAt, account.UpdatedAt = now, now
	if account.Status == "" {
		account.Status = domain.AccountConfigured
	}
	for i := range account.Endpoints {
		if account.Endpoints[i].ID == "" {
			account.Endpoints[i].ID = rand.Text()
		}
		account.Endpoints[i].CreatedAt, account.Endpoints[i].UpdatedAt = now, now
	}
	if err := account.Validate(); err != nil {
		return result, err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return result, storageError("开始账号创建", err)
	}
	defer rollback(tx, &err)
	if _, err := tx.ExecContext(ctx, `INSERT INTO account
		(id, provider_code, email, display_name, color_index, sort_order, status, sync_enabled, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, account.ID, account.ProviderCode, account.Email,
		account.DisplayName, account.ColorIndex, account.SortOrder, account.Status, account.SyncEnabled,
		account.CreatedAt, account.UpdatedAt); err != nil {
		return result, accountWriteError(err)
	}
	for _, endpoint := range account.Endpoints {
		if err := insertEndpoint(ctx, tx, account.ID, endpoint); err != nil {
			return result, err
		}
	}
	if err := tx.Commit(); err != nil {
		return result, storageError("提交账号创建", err)
	}
	return account, nil
}

func (s *Store) GetAccount(ctx context.Context, id string) (domain.Account, error) {
	if !domain.ValidAccountID(id) {
		return domain.Account{}, domain.ErrInvalidAccount
	}
	accounts, err := s.accounts(ctx, id)
	if err != nil {
		return domain.Account{}, err
	}
	if len(accounts) == 0 {
		return domain.Account{}, domain.ErrAccountNotFound
	}
	return accounts[0], nil
}

func (s *Store) ListAccounts(ctx context.Context) ([]domain.Account, error) {
	return s.accounts(ctx, "")
}

func (s *Store) accounts(ctx context.Context, id string) (result []domain.Account, err error) {
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return nil, storageError("开始账号读取", err)
	}
	defer rollback(tx, &err)
	result, err = readAccounts(ctx, tx, id)
	if err != nil {
		return nil, err
	}
	return result, storageError("结束账号读取", tx.Commit())
}

func (s *Store) UpdateAccount(ctx context.Context, account domain.Account) (result domain.Account, err error) {
	if !domain.ValidAccountID(account.ID) {
		return result, domain.ErrInvalidAccount
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return result, storageError("开始账号更新", err)
	}
	defer rollback(tx, &err)
	existing, err := accountInTransaction(ctx, tx, account.ID)
	if err != nil {
		return result, err
	}
	account.Endpoints = slices.Clone(account.Endpoints)
	account.CreatedAt, account.UpdatedAt = existing.CreatedAt, max(time.Now().UnixMilli(), existing.UpdatedAt)
	for i := range account.Endpoints {
		for _, old := range existing.Endpoints {
			if old.Protocol == account.Endpoints[i].Protocol {
				account.Endpoints[i].ID = old.ID
				account.Endpoints[i].CreatedAt = old.CreatedAt
				account.Endpoints[i].UpdatedAt = account.UpdatedAt
			}
		}
	}
	if err := account.Validate(); err != nil {
		return result, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE account SET provider_code=?, email=?, display_name=?,
		color_index=?, sort_order=?, status=?, sync_enabled=?, updated_at=? WHERE id=?`,
		account.ProviderCode, account.Email, account.DisplayName, account.ColorIndex, account.SortOrder,
		account.Status, account.SyncEnabled, account.UpdatedAt, account.ID); err != nil {
		return result, accountWriteError(err)
	}
	for _, endpoint := range account.Endpoints {
		if _, err := tx.ExecContext(ctx, `UPDATE account_endpoint SET host=?, port=?, tls_mode=?,
			username=?, auth_kind=?, credential_ref=?, updated_at=? WHERE account_id=? AND protocol=?`,
			endpoint.Host, endpoint.Port, endpoint.TLSMode, endpoint.Username, endpoint.AuthKind,
			nullableReference(endpoint.CredentialRef), endpoint.UpdatedAt, account.ID, endpoint.Protocol); err != nil {
			return result, accountWriteError(err)
		}
	}
	if err := tx.Commit(); err != nil {
		return result, storageError("提交账号更新", err)
	}
	return account, nil
}

// DisconnectAccount 保留账号和连接，返回提交后不再被引用的凭据，供服务层清理 OS 条目。
func (s *Store) DisconnectAccount(ctx context.Context, id string) ([]string, error) {
	return s.removeAccount(ctx, id, false)
}

// DeleteAccount 只删除本地账号数据，不执行任何服务器操作；凭据清理由服务层另外编排。
func (s *Store) DeleteAccount(ctx context.Context, id string) ([]string, error) {
	return s.removeAccount(ctx, id, true)
}

func (s *Store) removeAccount(ctx context.Context, id string, purge bool) (references []string, err error) {
	if !domain.ValidAccountID(id) {
		return nil, domain.ErrInvalidAccount
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, storageError("开始账号移除", err)
	}
	defer rollback(tx, &err)
	account, err := accountInTransaction(ctx, tx, id)
	if err != nil {
		return nil, err
	}
	if purge {
		_, err = tx.ExecContext(ctx, "DELETE FROM account WHERE id=?", id)
	} else {
		now := max(time.Now().UnixMilli(), account.UpdatedAt)
		_, err = tx.ExecContext(ctx,
			"UPDATE account SET status='disconnected', sync_enabled=0, updated_at=? WHERE id=?", now, id)
		if err == nil {
			_, err = tx.ExecContext(ctx,
				"UPDATE account_endpoint SET credential_ref=NULL, updated_at=? WHERE account_id=?", now, id)
		}
	}
	if err != nil {
		return nil, storageError("移除账号配置", err)
	}
	references, err = unusedCredentials(ctx, tx, account)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, storageError("提交账号移除", err)
	}
	return references, nil
}

func unusedCredentials(ctx context.Context, tx *sql.Tx, account domain.Account) ([]string, error) {
	references := []string{}
	seen := map[string]bool{}
	for _, endpoint := range account.Endpoints {
		ref := endpoint.CredentialRef
		if ref == "" || seen[ref] {
			continue
		}
		seen[ref] = true
		var count int
		if err := tx.QueryRowContext(ctx,
			"SELECT count(*) FROM account_endpoint WHERE credential_ref=?", ref).Scan(&count); err != nil {
			return nil, storageError("检查凭据引用", err)
		}
		if count == 0 {
			references = append(references, ref)
		}
	}
	sort.Strings(references)
	return references, nil
}

func insertEndpoint(ctx context.Context, tx *sql.Tx, accountID string, endpoint domain.AccountEndpoint) error {
	_, err := tx.ExecContext(ctx, `INSERT INTO account_endpoint
		(id, account_id, protocol, host, port, tls_mode, username, auth_kind, credential_ref, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, endpoint.ID, accountID, endpoint.Protocol, endpoint.Host,
		endpoint.Port, endpoint.TLSMode, endpoint.Username, endpoint.AuthKind,
		nullableReference(endpoint.CredentialRef), endpoint.CreatedAt, endpoint.UpdatedAt)
	return accountWriteError(err)
}

func nullableReference(reference string) sql.NullString {
	return sql.NullString{String: reference, Valid: reference != ""}
}

func accountWriteError(err error) error {
	var sqliteError *sqlite.Error
	if errors.As(err, &sqliteError) && (sqliteError.Code() == 1555 || sqliteError.Code() == 2067) {
		err = errors.Join(domain.ErrAccountConflict, err)
	}
	return storageError("写入账号配置", err)
}
