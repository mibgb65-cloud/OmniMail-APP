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
	if !acc1.IsDefault || !acc1.HasCredential || acc1.Name != "Gmail" {
		t.Fatalf("首个账户应自动设为默认、已存凭据且使用精简默认名 Gmail: %+v", acc1)
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
	if acc2.Name != "Naver" {
		t.Fatalf("Naver 默认简称应为 Naver，实际: %q", acc2.Name)
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

func TestAccountDefaultConciseNamesAndRenamePersistence(t *testing.T) {
	dir := t.TempDir()
	db, err := storage.OpenProfileDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)

	vault, err := security.OpenVault("work", dir)
	if err != nil {
		t.Fatal(err)
	}

	imapAcc, err := Create(db, vault, ConnectRequest{
		Email:        "xiarui@ganlion.cc",
		Provider:     "imap",
		AuthMode:     "imap",
		Secret:       "SecretPass123",
		ImapHost:     "imap.exmail.qq.com",
		ImapPort:     993,
		ImapSecurity: "SSL/TLS",
		SmtpHost:     "smtp.exmail.qq.com",
		SmtpPort:     465,
		SmtpSecurity: "SSL/TLS",
		SkipProbe:    true,
	})
	if err != nil {
		t.Fatalf("创建 IMAP 企业账户失败: %v", err)
	}
	if imapAcc.Name != "ganlion.cc" || imapAcc.ShortTag != "ganlion.cc" {
		t.Fatalf("手动 IMAP 未命名时应默认使用邮箱域名 ganlion.cc: got name=%q shortTag=%q", imapAcc.Name, imapAcc.ShortTag)
	}

	newName := "腾讯企业邮"
	renamed, err := Update(db, vault, UpdateRequest{
		ID:   imapAcc.ID,
		Name: &newName,
	})
	if err != nil {
		t.Fatalf("重命名账户失败: %v", err)
	}
	if renamed.Name != "腾讯企业邮" || renamed.ShortTag != "腾讯企业邮" {
		t.Fatalf("Update 仅更新 Name 时应同步刷新 ShortTag: got name=%q shortTag=%q", renamed.Name, renamed.ShortTag)
	}

	reloaded, err := GetByID(db, vault, imapAcc.ID)
	if err != nil {
		t.Fatal(err)
	}
	if reloaded.Name != "腾讯企业邮" || reloaded.ShortTag != "腾讯企业邮" {
		t.Fatalf("重命名未落盘持久化: %+v", reloaded)
	}

	exmailAcc, err := Create(db, vault, ConnectRequest{
		Email:     "ops@ganlion.cc",
		Provider:  "tencent_exmail",
		AuthMode:  "app-password",
		Secret:    "ExmailSecret123",
		SkipProbe: true,
	})
	if err != nil {
		t.Fatalf("创建腾讯企业邮账户失败: %v", err)
	}
	if exmailAcc.Name != "腾讯企业邮" || exmailAcc.ProviderLabel != "腾讯企业邮" {
		t.Fatalf("腾讯企业邮预设默认名称异常: %+v", exmailAcc)
	}
}
