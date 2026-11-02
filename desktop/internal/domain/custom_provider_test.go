package domain

import (
	"strings"
	"testing"
)

func TestCustomProviderValidation(t *testing.T) {
	base := CustomProvider{Code: "saved_" + strings.Repeat("a", 32), Name: "团队邮箱",
		IMAP: ProviderServer{Host: "imap.example.invalid", Port: 993, TLSMode: TLSImplicit},
		SMTP: ProviderServer{Host: "smtp.example.invalid", Port: 587, TLSMode: TLSStartTLS}}
	if !base.Valid() || len(base.Preset().Endpoints) != 2 || len(base.Preset().AuthKinds) != 1 {
		t.Fatal("合法模板无效")
	}
	for _, change := range []func(*CustomProvider){
		func(p *CustomProvider) { p.Code = "custom" }, func(p *CustomProvider) { p.Name = "" },
		func(p *CustomProvider) { p.Name = "x\n" }, func(p *CustomProvider) { p.Name = strings.Repeat("中", 50) },
		func(p *CustomProvider) { p.IMAP.Host = "https://mail.invalid/" }, func(p *CustomProvider) { p.IMAP.Port = 0 },
		func(p *CustomProvider) { p.SMTP.Port = 65536 }, func(p *CustomProvider) { p.SMTP.TLSMode = "none" },
	} {
		value := base
		change(&value)
		if value.Valid() {
			t.Fatal("接受非法模板")
		}
	}
	if err := ValidateCustomProviders([]CustomProvider{base, base}); err == nil {
		t.Fatal("不能保存重复标识/名称")
	}
}
