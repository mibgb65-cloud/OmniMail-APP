package accounts

import (
	"encoding/json"
	"strings"
	"testing"

	"omnimail/internal/security"
	"omnimail/internal/storage"
)

func TestAccountCRUDAndCredentialIsolation(t *testing.T) {
	dir := t.TempDir()
	db, err := storage.OpenProfileDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)

	vault, err := security.OpenVault("personal", dir)
	if err != nil {
		t.Fatal(err)
	}

	acc1, err := Create(db, vault, ConnectRequest{
		Email:     "dev@gmail.com",
		Provider:  "gmail",
		AuthMode:  "app-password",
		Secret:    "abcd efgh ijkl mnop",
		SkipProbe: true,
	})
	if err != nil {
		t.Fatalf("创建账户失败: %v", err)
	}
	if !acc1.IsDefault || !acc1.HasCredential {
		t.Fatalf("首个账户应自动设为默认且已存凭据: %+v", acc1)
	}

	rawDTO, _ := json.Marshal(acc1)
	if strings.Contains(string(rawDTO), "abcdefghijklmnop") || strings.Contains(string(rawDTO), "abcd efgh") {
		t.Fatal("严重违规：EmailAccountDTO 序列化结果中暴露了明文密码")
	}

	acc2, err := Create(db, vault, ConnectRequest{
		Email:     "ops@naver.com",
		Provider:  "nevermail",
		AuthMode:  "app-password",
		Secret:    "NAVERSECRET99",
		SkipProbe: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := SetDefault(db, acc2.ID); err != nil {
		t.Fatalf("SetDefault 失败: %v", err)
	}
	if err := Remove(db, vault, acc1.ID); err != nil {
		t.Fatalf("Remove 失败: %v", err)
	}
	if _, ok := vault.Get(VaultImapPassKey(acc1.ID)); ok {
		t.Fatal("删除账户后凭据盒中不应残留其密码")
	}
}
