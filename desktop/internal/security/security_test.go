package security

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"omnimail/internal/apperr"
)

func TestVaultDPAPINoPlaintextAndProfileIsolation(t *testing.T) {
	dir := t.TempDir()
	v, err := OpenVault("personal", dir)
	if err != nil {
		t.Fatalf("打开凭据盒失败: %v", err)
	}
	secretVal := "my-ultra-secret-app-password-998877"
	if err := v.Set("account:acc-1:imap_pass", secretVal); err != nil {
		t.Fatalf("写入凭据失败: %v", err)
	}

	rawBytes, err := os.ReadFile(filepath.Join(dir, "secrets.vault"))
	if err != nil {
		t.Fatalf("读取 secrets.vault 文件失败: %v", err)
	}
	if !bytes.HasPrefix(rawBytes, []byte("OMVT")) {
		t.Fatal("secrets.vault 缺少 OMVT 魔数头")
	}
	if bytes.Contains(rawBytes, []byte(secretVal)) {
		t.Fatal("严重安全违规：secrets.vault 磁盘文件中包含明文密码")
	}

	vReload, err := OpenVault("personal", dir)
	if err != nil {
		t.Fatalf("重新加载凭据盒失败: %v", err)
	}
	got, ok := vReload.Get("account:acc-1:imap_pass")
	if !ok || got != secretVal {
		t.Fatalf("解密凭据不一致: got=%q", got)
	}

	// 验证跨 Profile 熵隔离：直接用不同 profileID 打开同一文件必须拒绝解密
	if _, err := OpenVault("other-profile", dir); err == nil {
		t.Fatal("跨 Profile 熵绑定失效：不应允许其他空间直接解密同一凭据盒")
	}
}

func TestPINGuardArgon2idAndCooldown(t *testing.T) {
	salt, hash, err := HashPIN("246810")
	if err != nil {
		t.Fatalf("HashPIN 失败: %v", err)
	}
	if !VerifyPIN("246810", salt, hash) || VerifyPIN("000000", salt, hash) {
		t.Fatal("VerifyPIN 校验逻辑异常")
	}

	guard := NewPINGuard()
	fakeNow := time.Now()
	guard.nowFn = func() time.Time { return fakeNow }

	for i := 0; i < 5; i++ {
		err := guard.CheckAndVerify("p1", "wrong", salt, hash)
		if apperr.CodeOf(err) != apperr.CodePinInvalid {
			t.Fatalf("第 %d 次错误应返回 ERR_PIN_INVALID: %v", i+1, err)
		}
	}
	// 第 6 次即便输入正确 PIN，在 30 秒冷却期内仍应拦截
	if err := guard.CheckAndVerify("p1", "246810", salt, hash); err == nil {
		t.Fatal("冷却期内不应允许验证通过")
	}
	fakeNow = fakeNow.Add(31 * time.Second)
	if err := guard.CheckAndVerify("p1", "246810", salt, hash); err != nil {
		t.Fatalf("冷却期结束后正确 PIN 应放行: %v", err)
	}
}

func TestRedactAndMasking(t *testing.T) {
	rawLog := `C: a01 LOGIN "user@example.com" "SuperSecret123" | Authorization: Bearer ya29.a0AfH6S | sk-proj-1234567890abcdef`
	clean := RedactSensitive(rawLog)
	if strings.Contains(clean, "SuperSecret123") || strings.Contains(clean, "ya29.a0AfH6S") || strings.Contains(clean, "1234567890abcdef") {
		t.Fatalf("日志脱敏不彻底: %s", clean)
	}
	masked := MaskSecret("sk-proj-123456789abc9f2a")
	if strings.Contains(masked, "123456789") || !strings.HasSuffix(masked, "9f2a") {
		t.Fatalf("API Key 脱敏展示异常: %s", masked)
	}
	if got := MaskEmail("alice@domain.com"); got != "a***@domain.com" {
		t.Fatalf("邮箱脱敏异常: %s", got)
	}
}
