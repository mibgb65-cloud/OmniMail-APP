package profilemgr

import (
	"testing"

	"omnimail/internal/config"
	"omnimail/internal/security"
)

func TestLegacyGatewaySecretMigratesOnlyToSavedEndpoint(t *testing.T) {
	vault, err := security.OpenVault("personal", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	const fixture = "legacy-gateway-fixture"
	const savedURL = "https://gateway.example.com/v1"
	const otherURL = "https://other.example.com/v1"
	legacy := config.LegacyAiVaultKey("custom")
	if err := vault.Set(legacy, fixture); err != nil {
		t.Fatal(err)
	}
	settings := config.AppSettings{AiProvider: "custom", AiBaseURL: savedURL + "/"}
	migrateAiEndpointKey(vault, settings)
	if _, ok := vault.Get(legacy); ok {
		t.Fatal("旧的未限定端点凭据应删除")
	}
	if got, ok := vault.Get(config.AiVaultKey("custom", savedURL)); !ok || got != fixture {
		t.Fatal("旧密钥应只绑定原有的保存端点")
	}
	settings.AiBaseURL = otherURL
	migrateAiEndpointKey(vault, settings)
	if _, ok := vault.Get(config.AiVaultKey("custom", otherURL)); ok {
		t.Fatal("后续变更端点不得复制密钥")
	}
}
