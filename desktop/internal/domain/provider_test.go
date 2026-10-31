package domain

import "testing"

func TestProviderPresetsAreIndependent(t *testing.T) {
	seen := map[string]bool{}
	for _, preset := range ProviderPresets() {
		if seen[preset.Code] || !providerPattern.MatchString(preset.Code) ||
			len(preset.Endpoints) != 2 || len(preset.AuthKinds) == 0 {
			t.Fatal("预设定义不完整或重复")
		}
		seen[preset.Code] = true
		for _, endpoint := range preset.Endpoints {
			if preset.Code != "custom" && !validHost(endpoint.Host) {
				t.Fatal("内置预设主机无效")
			}
		}
	}
	preset, found := FindProviderPreset("gmail")
	if !found {
		t.Fatal("Gmail 预设缺失")
	}
	preset.Endpoints[0].Host = "changed.invalid"
	preset.AuthKinds[0] = AuthPassword
	again, found := FindProviderPreset("gmail")
	if !found || again.Endpoints[0].Host != "imap.gmail.com" || again.AuthKinds[0] != AuthOAuth2 {
		t.Fatal("调用方污染了全局预设")
	}
	if _, found := FindProviderPreset("missing"); found {
		t.Fatal("未知预设被错误识别")
	}
}

func TestLinuxDoPresetUsesOfficialTLSEndpoints(t *testing.T) {
	preset, found := FindProviderPreset("linuxdo")
	if !found || len(preset.Endpoints) != 2 {
		t.Fatal("缺少 LinuxDo 服务商预设")
	}
	for i, port := range []int{993, 465} {
		if preset.Endpoints[i].Host != "mail.linux.do" || preset.Endpoints[i].Port != port ||
			preset.Endpoints[i].TLSMode != TLSImplicit {
			t.Fatal("LinuxDo 未使用官方 TLS 主机和端口")
		}
	}
}

func TestInternationalProviderPresets(t *testing.T) {
	for _, test := range []struct {
		code, imap, smtp string
		port             int
		tls              TLSMode
	}{
		{"naver", "imap.naver.com", "smtp.naver.com", 587, TLSStartTLS},
		{"yandex", "imap.yandex.com", "smtp.yandex.com", 465, TLSImplicit},
		{"icloud", "imap.mail.me.com", "smtp.mail.me.com", 587, TLSStartTLS},
		{"yahoo", "imap.mail.yahoo.com", "smtp.mail.yahoo.com", 465, TLSImplicit},
	} {
		t.Run(test.code, func(t *testing.T) {
			preset, found := FindProviderPreset(test.code)
			if !found || len(preset.Endpoints) != 2 {
				t.Fatal("缺少完整的服务商预设")
			}
			if len(preset.AuthKinds) != 1 || preset.AuthKinds[0] != AuthPassword {
				t.Fatal("应用密码登录不能宣称已实现 OAuth")
			}
			incoming, outgoing := preset.Endpoints[0], preset.Endpoints[1]
			if incoming.Protocol != ProtocolIMAP || incoming.Host != test.imap ||
				incoming.Port != 993 || incoming.TLSMode != TLSImplicit {
				t.Fatal("收信端点不符合官方配置")
			}
			if outgoing.Protocol != ProtocolSMTP || outgoing.Host != test.smtp ||
				outgoing.Port != test.port || outgoing.TLSMode != test.tls {
				t.Fatal("发信端点不符合官方配置，不能混用隐式 TLS 和 STARTTLS")
			}
		})
	}
}
