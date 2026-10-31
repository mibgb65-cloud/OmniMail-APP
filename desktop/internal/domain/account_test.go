package domain

import (
	"errors"
	"strings"
	"testing"
)

func validAccount() Account {
	return Account{
		ID: "account-test", ProviderCode: "custom", Email: "person+work@example.invalid",
		Status: AccountConfigured, SyncEnabled: true, CreatedAt: 1, UpdatedAt: 1,
		Endpoints: []AccountEndpoint{
			{ID: "imap-test", Protocol: ProtocolIMAP, Host: "imap.example.invalid", Port: 993,
				TLSMode: TLSImplicit, Username: "imap-user", AuthKind: AuthPassword,
				CredentialRef: "omnimail/account/account-test/imap", CreatedAt: 1, UpdatedAt: 1},
			{ID: "smtp-test", Protocol: ProtocolSMTP, Host: "smtp.example.invalid", Port: 587,
				TLSMode: TLSStartTLS, Username: "smtp-user", AuthKind: AuthOAuth2,
				CredentialRef: "omnimail/account/account-test/smtp", CreatedAt: 1, UpdatedAt: 1},
		},
	}
}

func TestAccountValidation(t *testing.T) {
	tests := []struct {
		name   string
		change func(*Account)
	}{
		{"账号标识", func(a *Account) { a.ID = "../bad" }},
		{"服务商标识", func(a *Account) { a.ProviderCode = "bad provider" }},
		{"地址格式", func(a *Account) { a.Email = "Name <person@example.invalid>" }},
		{"地址控制字符", func(a *Account) { a.Email += "\r\n" }},
		{"超长显示名", func(a *Account) { a.DisplayName = strings.Repeat("x", 257) }},
		{"非法 UTF8", func(a *Account) { a.DisplayName = string([]byte{255}) }},
		{"显示名控制字符", func(a *Account) { a.DisplayName = "bad\x00name" }},
		{"颜色范围", func(a *Account) { a.ColorIndex = 6 }},
		{"排序范围", func(a *Account) { a.SortOrder = -1 }},
		{"非法状态", func(a *Account) { a.Status = "unknown" }},
		{"断开仍同步", func(a *Account) { a.Status = AccountDisconnected }},
		{"非法时间", func(a *Account) { a.UpdatedAt = 0 }},
		{"缺少连接", func(a *Account) { a.Endpoints = a.Endpoints[:1] }},
		{"重复协议", func(a *Account) { a.Endpoints[1].Protocol = ProtocolIMAP }},
		{"重复连接ID", func(a *Account) { a.Endpoints[1].ID = a.Endpoints[0].ID }},
		{"连接ID格式", func(a *Account) { a.Endpoints[0].ID = "/" }},
		{"非法协议", func(a *Account) { a.Endpoints[0].Protocol = "pop3" }},
		{"主机 URL", func(a *Account) { a.Endpoints[0].Host = "https://mail.example.invalid" }},
		{"主机空标签", func(a *Account) { a.Endpoints[0].Host = "bad..invalid" }},
		{"主机连字符", func(a *Account) { a.Endpoints[0].Host = "-bad.invalid" }},
		{"主机 Unicode", func(a *Account) { a.Endpoints[0].Host = "邮件.example" }},
		{"空主机", func(a *Account) { a.Endpoints[0].Host = "" }},
		{"过长主机标签", func(a *Account) { a.Endpoints[0].Host = strings.Repeat("a", 64) }},
		{"零端口", func(a *Account) { a.Endpoints[0].Port = 0 }},
		{"超限端口", func(a *Account) { a.Endpoints[0].Port = 65536 }},
		{"明文连接", func(a *Account) { a.Endpoints[0].TLSMode = "none" }},
		{"非法认证类型", func(a *Account) { a.Endpoints[0].AuthKind = "unknown" }},
		{"空用户名", func(a *Account) { a.Endpoints[0].Username = "" }},
		{"用户名控制字符", func(a *Account) { a.Endpoints[0].Username = "bad\nuser" }},
		{"其他应用凭据", func(a *Account) { a.Endpoints[0].CredentialRef = "other/secret" }},
		{"连接时间", func(a *Account) { a.Endpoints[0].CreatedAt = 0 }},
		{"断开仍有凭据", func(a *Account) { a.Status, a.SyncEnabled = AccountDisconnected, false }},
	}
	if err := validAccount().Validate(); err != nil {
		t.Fatal(err)
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			account := validAccount()
			test.change(&account)
			if err := account.Validate(); !errors.Is(err, ErrInvalidAccount) {
				t.Fatalf("未拒绝非法配置：%v", err)
			}
		})
	}
}

func TestAccountAllowsIndependentConnectionsAndUnknownPreset(t *testing.T) {
	account := validAccount()
	account.ProviderCode = "future_provider"
	for _, host := range []string{"mail.internal", "192.168.1.2", "2001:db8::1", "MAIL.EXAMPLE.INVALID."} {
		account.Endpoints[0].Host = host
		if err := account.Validate(); err != nil {
			t.Fatalf("合法自建服务器被拒绝：%v", err)
		}
	}
	account.Status, account.SyncEnabled = AccountDisconnected, false
	for i := range account.Endpoints {
		account.Endpoints[i].CredentialRef = ""
	}
	if err := account.Validate(); err != nil {
		t.Fatal(err)
	}
}
