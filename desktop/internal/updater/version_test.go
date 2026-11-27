package updater

import "testing"

func TestThreeTrackVersionOrderingAndInstallerNames(t *testing.T) {
	if got := InstallerAssetFileName("v0.0.1"); got != "OmniMail-windows-Setup-v0.0.1.exe" {
		t.Fatalf("正式版安装包名不符合规范：%s", got)
	}
	if got := InstallerAssetFileName("v1.2.0-beta.1"); got != "OmniMail-windows-Setup-v1.2.0.beta.1.exe" {
		t.Fatalf("Beta 标签安装包名不符合规范：%s", got)
	}
	if got := InstallerAssetFileName("v1.2.0.beta.3"); got != "OmniMail-windows-Setup-v1.2.0.beta.3.exe" {
		t.Fatalf("Beta 点号安装包名不符合规范：%s", got)
	}
	if got := InstallerAssetFileName("v1.2.0-alpha.2"); got != "OmniMail-windows-Setup-v1.2.0.alpha.2.exe" {
		t.Fatalf("Alpha 标签安装包名不符合规范：%s", got)
	}

	chain := []string{
		"v1.2.0-alpha.1",
		"v1.2.0-alpha.2",
		"v1.2.0-beta.1",
		"v1.2.0.beta.2",
		"v1.2.0",
		"v1.2.1-alpha.1",
	}
	for i := 0; i < len(chain)-1; i++ {
		if !IsNewerVersion(chain[i], chain[i+1]) {
			t.Fatalf("版本序比较失败：期望 %s < %s", chain[i], chain[i+1])
		}
		if IsNewerVersion(chain[i+1], chain[i]) {
			t.Fatalf("版本反向比较失败：期望 !(%s < %s)", chain[i+1], chain[i])
		}
	}
	if NormalizeChannel("", "v1.2.0-alpha.1") != "alpha" {
		t.Fatal("v1.2.0-alpha.1 应推导为 alpha 通道")
	}
	if NormalizeChannel("", "v1.2.0-beta.1") != "beta" {
		t.Fatal("v1.2.0-beta.1 应推导为 beta 通道")
	}
}
