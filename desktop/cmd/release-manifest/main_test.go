package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"os"
	"path/filepath"
	"testing"

	"omnimail/desktop/internal/updater"
)

func TestReleaseManifest(t *testing.T) {
	public, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	// 测试随机密钥只存在内存，不是正式发布材料，不写盘或打印。
	t.Setenv("UPDATE_MANIFEST_PRIVATE_KEY", base64.StdEncoding.EncodeToString(private.Seed()))
	t.Setenv("UPDATE_PUBLIC_KEY", base64.StdEncoding.EncodeToString(public))
	if err := run([]string{"--check-key"}); err != nil {
		t.Fatal("正确密钥预检失败")
	}
	dir := t.TempDir()
	file, notes := filepath.Join(dir, updater.PackageName("1.2.3")), filepath.Join(dir, "notes.txt")
	for path, data := range map[string][]byte{file: []byte("synthetic installer"), notes: []byte("合成说明")} {
		if err := os.WriteFile(path, data, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	args := []string{"--version", "1.2.3", "--package", file, "--notes", notes, "--out", dir}
	if err := run(args); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(dir, "update-windows-amd64.json"))
	if err != nil {
		t.Fatal(err)
	}
	sig, err := os.ReadFile(filepath.Join(dir, "update-windows-amd64.sig"))
	if err != nil {
		t.Fatal(err)
	}
	value, err := updater.VerifyManifest(raw, sig, os.Getenv("UPDATE_PUBLIC_KEY"))
	if err != nil || value.Version != "1.2.3" || value.Notes != "合成说明" || value.Size != 19 {
		t.Fatalf("清单不能被应用独立验证: %+v, %v", value, err)
	}
	for _, name := range []string{"UPDATE_MANIFEST_PRIVATE_KEY", "UPDATE_PUBLIC_KEY"} {
		t.Run("缺少"+name, func(t *testing.T) {
			t.Setenv(name, "")
			if run(args) == nil {
				t.Fatal("缺少材料不能生成发布清单")
			}
		})
	}
	t.Run("损坏私钥不能仅凭公钥尾部通过", func(t *testing.T) {
		broken := append([]byte(nil), private...)
		broken[0] ^= 1
		t.Setenv("UPDATE_MANIFEST_PRIVATE_KEY", base64.StdEncoding.EncodeToString(broken))
		if run([]string{"--check-key"}) == nil {
			t.Fatal("损坏私钥不能通过预检")
		}
	})
	t.Run("空安装包", func(t *testing.T) {
		if err := os.WriteFile(file, nil, 0o600); err != nil {
			t.Fatal(err)
		}
		if run(args) == nil {
			t.Fatal("空包不能发布")
		}
	})
	if run([]string{"--version", "../1.2.3"}) == nil {
		t.Fatal("非法参数不能通过")
	}
}
