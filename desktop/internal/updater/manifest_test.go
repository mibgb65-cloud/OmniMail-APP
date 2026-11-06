package updater

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
)

func TestVerifyManifest(t *testing.T) {
	public, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	key := base64.StdEncoding.EncodeToString(public)
	valid := Manifest{Schema: 1, App: "OmniMail", Repository: Repository, Version: "1.2.3",
		Platform: "windows", Arch: "amd64", File: PackageName("1.2.3"), Size: 123,
		SHA256: strings.Repeat("a", 64), Notes: "合成说明"}
	for _, test := range []struct {
		name   string
		change func(*Manifest)
	}{
		{"正确", func(*Manifest) {}},
		{"错误仓库", func(v *Manifest) { v.Repository = "other/repo" }},
		{"路径穿越", func(v *Manifest) { v.File = "../setup.exe" }},
		{"空包", func(v *Manifest) { v.Size = 0 }},
		{"超限", func(v *Manifest) { v.Size = (256 << 20) + 1 }},
		{"错误平台", func(v *Manifest) { v.Platform = "linux" }},
		{"说明超长", func(v *Manifest) { v.Notes = strings.Repeat("a", (32<<10)+1) }},
		{"非法哈希", func(v *Manifest) { v.SHA256 = strings.Repeat("z", 64) }},
	} {
		t.Run(test.name, func(t *testing.T) {
			value := valid
			test.change(&value)
			raw, err := json.Marshal(value)
			if err != nil {
				t.Fatal(err)
			}
			sig := []byte(base64.StdEncoding.EncodeToString(ed25519.Sign(private, append([]byte(SignaturePrefix), raw...))))
			_, err = VerifyManifest(raw, sig, key)
			if (err == nil) != (test.name == "正确") {
				t.Fatalf("清单边界校验错误: %v", err)
			}
			if test.name == "正确" {
				raw[0] ^= 1
				if _, err := VerifyManifest(raw, sig, key); err == nil {
					t.Fatal("篡改清单不能通过签名")
				}
				if _, err := VerifyManifest(raw, sig, ""); err == nil {
					t.Fatal("无公钥不能通过")
				}
			}
		})
	}
}

func TestVersionComparison(t *testing.T) {
	for _, value := range []string{"v1.2.3", "1.2.3-dev", "01.2.3", "1.2", "../1.2.3"} {
		if ValidVersion(value) || Newer(value, "1.0.0") {
			t.Fatalf("非法版本不应参与更新: %s", value)
		}
	}
	if !Newer("1.10.0", "1.9.9") || Newer("1.2.3", "1.2.3") || Newer("1.2.2", "1.2.3") {
		t.Fatal("版本比较不能采用字典顺序或允许降级")
	}
}
