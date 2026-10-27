package repository

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"

	"omnimail/desktop/internal/domain"
)

func accountInput(provider string) domain.Account {
	return domain.Account{
		ProviderCode: provider, Email: "person@example.invalid", DisplayName: "测试账号",
		Status: domain.AccountConfigured, SyncEnabled: true,
		Endpoints: []domain.AccountEndpoint{
			{Protocol: domain.ProtocolIMAP, Host: "imap.example.invalid", Port: 993,
				TLSMode: domain.TLSImplicit, Username: "imap-user", AuthKind: domain.AuthPassword,
				CredentialRef: "omnimail/account/test/imap"},
			{Protocol: domain.ProtocolSMTP, Host: "smtp.example.invalid", Port: 587,
				TLSMode: domain.TLSStartTLS, Username: "smtp-user", AuthKind: domain.AuthOAuth2,
				CredentialRef: "omnimail/account/test/smtp"},
		},
	}
}

func createTestAccount(t *testing.T, store *Store, input domain.Account) domain.Account {
	t.Helper()
	account, err := store.CreateAccount(t.Context(), input)
	if err != nil {
		t.Fatal(err)
	}
	return account
}

func TestAccountRoundTripAndMultipleProviders(t *testing.T) {
	store := openTestStore(t)
	input := accountInput("gmail")
	first := createTestAccount(t, store, input)
	input.DisplayName = "第二个 Gmail"
	input.Endpoints[0].Host = "override.example.invalid"
	input.SortOrder = 1
	second := createTestAccount(t, store, input)
	createTestAccount(t, store, accountInput("qq"))
	createTestAccount(t, store, accountInput("netease_163"))
	createTestAccount(t, store, accountInput("future_provider"))
	if first.ID == second.ID || input.ID != "" || input.Endpoints[0].ID != "" {
		t.Fatal("创建覆盖了其他账号或修改了调用方输入")
	}
	got, err := store.GetAccount(t.Context(), first.ID)
	if err != nil || !reflect.DeepEqual(got, first) {
		t.Fatalf("账号未完整往返：%v", err)
	}
	accounts, err := store.ListAccounts(t.Context())
	if err != nil || len(accounts) != 5 || accounts[len(accounts)-1].ID != second.ID {
		t.Fatalf("账号列表或排序错误：%v / %d", err, len(accounts))
	}
	if _, err := store.CreateAccount(t.Context(), first); !errors.Is(err, domain.ErrAccountConflict) {
		t.Fatalf("相同 ID 未产生冲突：%v", err)
	}
}

func TestAccountsPersistAcrossOpen(t *testing.T) {
	directory := t.TempDir()
	store, err := Open(t.Context(), directory)
	if err != nil {
		t.Fatal(err)
	}
	account := createTestAccount(t, store, accountInput("future_provider"))
	if err := store.Close(); err != nil {
		t.Fatal(err)
	}
	reopened, err := Open(t.Context(), directory)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := reopened.Close(); err != nil {
			t.Error(err)
		}
	})
	got, err := reopened.GetAccount(t.Context(), account.ID)
	if err != nil || !reflect.DeepEqual(got, account) {
		t.Fatalf("重新打开丢失账号：%v", err)
	}
}

func TestAccountCreationIsAtomic(t *testing.T) {
	store := openTestStore(t)
	first := createTestAccount(t, store, accountInput("custom"))
	invalid := accountInput("custom")
	invalid.Endpoints[0].Port = 0
	if _, err := store.CreateAccount(t.Context(), invalid); !errors.Is(err, domain.ErrInvalidAccount) {
		t.Fatalf("未拒绝非法端口：%v", err)
	}
	conflict := accountInput("custom")
	conflict.Endpoints[1].ID = first.Endpoints[0].ID
	if _, err := store.CreateAccount(t.Context(), conflict); !errors.Is(err, domain.ErrAccountConflict) {
		t.Fatalf("未返回连接 ID 冲突：%v", err)
	}
	accounts, err := store.ListAccounts(t.Context())
	if err != nil || len(accounts) != 1 {
		t.Fatalf("失败创建留下部分账号：%v / %d", err, len(accounts))
	}
	var endpoints int
	if err := store.db.QueryRow("SELECT count(*) FROM account_endpoint").Scan(&endpoints); err != nil || endpoints != 2 {
		t.Fatalf("失败创建留下部分连接：%v / %d", err, endpoints)
	}
	if _, err := store.db.Exec("UPDATE account_endpoint SET account_id='missing' WHERE id=?", first.Endpoints[0].ID); err == nil {
		t.Fatal("账号外键未生效")
	}
	if _, err := store.db.Exec("UPDATE account_endpoint SET port=0 WHERE id=?", first.Endpoints[0].ID); err == nil {
		t.Fatal("数据库端口约束未生效")
	}
}

func TestUpdateAccountAndRollback(t *testing.T) {
	store := openTestStore(t)
	account := createTestAccount(t, store, accountInput("custom"))
	account.DisplayName = "修改名称"
	account.Endpoints[0].Host = "changed.example.invalid"
	updated, err := store.UpdateAccount(t.Context(), account)
	if err != nil || updated.CreatedAt != account.CreatedAt || updated.Endpoints[0].ID != account.Endpoints[0].ID {
		t.Fatalf("更新丢失稳定身份：%v", err)
	}
	if _, err := store.db.Exec(`CREATE TRIGGER reject_smtp_update BEFORE UPDATE ON account_endpoint
		WHEN NEW.protocol='smtp' BEGIN SELECT RAISE(ABORT, 'sensitive-value'); END`); err != nil {
		t.Fatal(err)
	}
	candidate := updated
	candidate.Endpoints = append([]domain.AccountEndpoint(nil), updated.Endpoints...)
	candidate.DisplayName = "不应提交"
	candidate.Endpoints[0].Host = "rollback.example.invalid"
	if _, err := store.UpdateAccount(t.Context(), candidate); err == nil || strings.Contains(err.Error(), "sensitive-value") {
		t.Fatal("失败更新未安全返回错误")
	}
	got, err := store.GetAccount(t.Context(), account.ID)
	if err != nil || !reflect.DeepEqual(got, updated) {
		t.Fatalf("失败更新未完整回滚：%v", err)
	}
}

func TestDisconnectAndDeleteDoNotRemoveSharedCredentials(t *testing.T) {
	store := openTestStore(t)
	first := createTestAccount(t, store, accountInput("qq"))
	second := createTestAccount(t, store, accountInput("qq"))
	references, err := store.DisconnectAccount(t.Context(), first.ID)
	if err != nil || len(references) != 0 {
		t.Fatalf("共享凭据被判定可删除：%v", err)
	}
	disconnected, err := store.GetAccount(t.Context(), first.ID)
	if err != nil || disconnected.Status != domain.AccountDisconnected || disconnected.SyncEnabled ||
		len(disconnected.Endpoints) != 2 || disconnected.Endpoints[0].CredentialRef != "" {
		t.Fatalf("断开未保留配置或未解除引用：%v", err)
	}
	if err := disconnected.Validate(); err != nil {
		t.Fatal(err)
	}
	references, err = store.DeleteAccount(t.Context(), second.ID)
	if err != nil || len(references) != 2 {
		t.Fatalf("未返回最终无引用凭据：%v / %d", err, len(references))
	}
	if _, err := store.GetAccount(t.Context(), second.ID); !errors.Is(err, domain.ErrAccountNotFound) {
		t.Fatalf("账号未删除：%v", err)
	}
	got, err := store.GetAccount(t.Context(), first.ID)
	if err != nil || !reflect.DeepEqual(got, disconnected) {
		t.Fatalf("删除影响其他账号：%v", err)
	}
	var endpoints int
	if err := store.db.QueryRow("SELECT count(*) FROM account_endpoint").Scan(&endpoints); err != nil || endpoints != 2 {
		t.Fatalf("级联删除范围错误：%v", err)
	}
	references, err = store.DisconnectAccount(t.Context(), first.ID)
	if err != nil || len(references) != 0 {
		t.Fatalf("重复断开不幂等：%v", err)
	}
}

func TestAccountErrorsAndCancellation(t *testing.T) {
	store := openTestStore(t)
	account := createTestAccount(t, store, accountInput("custom"))
	if _, err := store.GetAccount(t.Context(), "../bad"); !errors.Is(err, domain.ErrInvalidAccount) {
		t.Fatalf("非法 ID 未拒绝：%v", err)
	}
	if _, err := store.GetAccount(t.Context(), "missing"); !errors.Is(err, domain.ErrAccountNotFound) {
		t.Fatalf("缺失账号错误不匹配：%v", err)
	}
	missing := account
	missing.ID = "missing"
	if _, err := store.UpdateAccount(t.Context(), missing); !errors.Is(err, domain.ErrAccountNotFound) {
		t.Fatalf("更新缺失账号错误不匹配：%v", err)
	}
	if _, err := store.DeleteAccount(t.Context(), "missing"); !errors.Is(err, domain.ErrAccountNotFound) {
		t.Fatalf("删除缺失账号错误不匹配：%v", err)
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if _, err := store.ListAccounts(ctx); !errors.Is(err, context.Canceled) {
		t.Fatalf("读取取消错误丢失：%v", err)
	}
	if _, err := store.CreateAccount(ctx, accountInput("custom")); !errors.Is(err, context.Canceled) {
		t.Fatalf("写入取消错误丢失：%v", err)
	}
}
