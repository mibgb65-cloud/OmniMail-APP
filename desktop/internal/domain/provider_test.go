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
