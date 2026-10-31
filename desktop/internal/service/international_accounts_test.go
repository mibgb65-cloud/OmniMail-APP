package service

import (
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestInternationalAccountsKeepPresetEndpointsAndAppPasswords(t *testing.T) {
	for _, provider := range []string{"naver", "yandex", "icloud", "yahoo"} {
		t.Run(provider, func(t *testing.T) {
			mail, store, secrets, _ := testService(t)
			preset, found := domain.FindProviderPreset(provider)
			if !found {
				t.Fatal("缺少预设")
			}
			input := addInput()
			input.ProviderCode = provider
			input.IMAP.Host, input.IMAP.Port, input.IMAP.TLSMode = preset.Endpoints[0].Host, preset.Endpoints[0].Port, preset.Endpoints[0].TLSMode
			input.SMTP.Host, input.SMTP.Port, input.SMTP.TLSMode = preset.Endpoints[1].Host, preset.Endpoints[1].Port, preset.Endpoints[1].TLSMode
			// 应用密码可能包含空格/连字符；只有既有 Gmail 归一化规则能修改密码，其他服务商必须保留原值。
			input.IMAP.Password, input.SMTP.Password = " synthetic-app-code ", " synthetic-app-code "
			transport := &passwordCheckingTransport{wantIMAP: input.IMAP.Password, wantSMTP: input.SMTP.Password}
			mail.transport = transport
			account, err := mail.AddAccount(t.Context(), input)
			if err != nil {
				t.Fatal(err)
			}
			saved, err := store.GetAccount(t.Context(), account.ID)
			if err != nil || saved.ProviderCode != provider {
				t.Fatal("服务商身份未持久保存")
			}
			for index, expected := range preset.Endpoints {
				endpoint := saved.Endpoints[index]
				if endpoint.Host != expected.Host || endpoint.Port != expected.Port || endpoint.TLSMode != expected.TLSMode {
					t.Fatal("持久化端点与预设不一致")
				}
				secret, err := secrets.Get(t.Context(), endpoint.CredentialRef)
				if err != nil || string(secret) != input.IMAP.Password {
					t.Fatal("持久化凭据与认证使用值不一致")
				}
				clear(secret)
			}
		})
	}
}
