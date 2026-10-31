package repository

import (
	"context"
	"database/sql"

	"omnimail/desktop/internal/domain"
)

func accountInTransaction(ctx context.Context, tx *sql.Tx, id string) (domain.Account, error) {
	accounts, err := readAccounts(ctx, tx, id)
	if err != nil {
		return domain.Account{}, err
	}
	if len(accounts) == 0 {
		return domain.Account{}, domain.ErrAccountNotFound
	}
	return accounts[0], nil
}

func readAccounts(ctx context.Context, tx *sql.Tx, id string) (accounts []domain.Account, err error) {
	accounts = []domain.Account{}
	condition, arguments := "", []any{}
	if id != "" {
		condition, arguments = " WHERE id=?", []any{id}
	}
	rows, err := tx.QueryContext(ctx, `SELECT id, provider_code, email, display_name,
		color_index, sort_order, status, sync_enabled, created_at, updated_at FROM account`+
		condition+" ORDER BY sort_order, created_at, id", arguments...)
	if err != nil {
		return nil, storageError("读取账号配置", err)
	}
	for rows.Next() {
		var account domain.Account
		if err := rows.Scan(&account.ID, &account.ProviderCode, &account.Email, &account.DisplayName,
			&account.ColorIndex, &account.SortOrder, &account.Status, &account.SyncEnabled,
			&account.CreatedAt, &account.UpdatedAt); err != nil {
			return nil, joinClose(storageError("解析账号配置", err), rows.Close())
		}
		account.Endpoints = []domain.AccountEndpoint{}
		accounts = append(accounts, account)
	}
	if err := joinClose(storageError("读取账号配置", rows.Err()), rows.Close()); err != nil {
		return nil, err
	}
	return accounts, readEndpoints(ctx, tx, id, accounts)
}

func readEndpoints(ctx context.Context, tx *sql.Tx, id string, accounts []domain.Account) (err error) {
	condition, arguments := "", []any{}
	if id != "" {
		condition, arguments = " WHERE account_id=?", []any{id}
	}
	rows, err := tx.QueryContext(ctx, `SELECT account_id, id, protocol, host, port, tls_mode,
		username, auth_kind, COALESCE(credential_ref, ''), created_at, updated_at
		FROM account_endpoint`+condition+" ORDER BY protocol", arguments...)
	if err != nil {
		return storageError("读取连接配置", err)
	}
	defer func() { err = joinClose(err, rows.Close()) }()
	indices := make(map[string]int, len(accounts))
	for i := range accounts {
		indices[accounts[i].ID] = i
	}
	for rows.Next() {
		var accountID string
		var endpoint domain.AccountEndpoint
		if err := rows.Scan(&accountID, &endpoint.ID, &endpoint.Protocol, &endpoint.Host, &endpoint.Port,
			&endpoint.TLSMode, &endpoint.Username, &endpoint.AuthKind, &endpoint.CredentialRef,
			&endpoint.CreatedAt, &endpoint.UpdatedAt); err != nil {
			return storageError("解析连接配置", err)
		}
		if index, found := indices[accountID]; found {
			accounts[index].Endpoints = append(accounts[index].Endpoints, endpoint)
		}
	}
	return storageError("读取连接配置", rows.Err())
}
