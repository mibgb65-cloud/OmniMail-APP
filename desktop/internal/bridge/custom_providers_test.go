package bridge

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"omnimail/desktop/internal/config"
	"omnimail/desktop/internal/service"
)

func TestCustomProvidersBridgeDoesNotPersistAccountFields(t *testing.T) {
	dir := t.TempDir()
	bridge := NewCustomProvidersBridge(service.NewCustomProviders(config.NewCustomProviders(dir)))
	var input service.CustomProviderInput
	data := `{"name":"测试服务商","email":"private@example.invalid","imap":{"host":"imap.example.invalid","port":993,"tlsMode":"implicit_tls","username":"private-user","password":"private-password"},"smtp":{"host":"smtp.example.invalid","port":587,"tlsMode":"starttls","token":"private-token"}}`
	if err := json.Unmarshal([]byte(data), &input); err != nil {
		t.Fatal(err)
	}
	value, err := bridge.Create(t.Context(), input)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(value.Code, "saved_") {
		t.Fatal("模板不能覆盖内置标识")
	}
	bytes, err := os.ReadFile(filepath.Join(dir, "custom-providers.json"))
	if err != nil {
		t.Fatal(err)
	}
	for _, forbidden := range []string{"private", "username", "password", "token", "email"} {
		if strings.Contains(string(bytes), forbidden) {
			t.Fatal("秘密字段进入模板文件")
		}
	}
	values, err := bridge.List(t.Context())
	if err != nil || len(values) != 1 || values[0].Code != value.Code {
		t.Fatal("桥接未读回真实模板")
	}
}
