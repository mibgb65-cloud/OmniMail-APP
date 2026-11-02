//go:build windows

package platform

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestInstallationRegistryNamespaces(t *testing.T) {
	if InstallationRegistryKey != `Software\OmniMail\Installation` {
		t.Errorf("生产安装记录不得使用开发运行的通用父键: %s", InstallationRegistryKey)
	}
	previous := InstallationRegistryKey
	t.Cleanup(func() { InstallationRegistryKey = previous })
	InstallationRegistryKey = `Software\OmniMail-Development\Installation`
	if startupValueName() != "OmniMail-Development" {
		t.Fatal("开发安装的登录启动项不能使用生产项名称")
	}
}

func TestSafeInstallPath(t *testing.T) {
	for _, value := range []string{
		"", `relative\data`, `C:\`, `\\server\share\data`, `\\?\C:\data`,
		`C:\data:stream`, `C:\data\..\other`, "C:\\data\n", "C:\\\xff",
		`C:\data"`, `C:\data.`, `C:\data `, strings.Repeat("a", 4097),
	} {
		if safeInstallPath(value) {
			t.Errorf("不应接受异常安装路径 %q", value)
		}
	}
	for _, value := range []string{`C:\Users\示例\邮件数据`, `D:\OmniMail\Data`} {
		if !safeInstallPath(value) {
			t.Errorf("不应拒绝正常安装路径 %q", value)
		}
	}
}

func TestInstallationDataAvailable(t *testing.T) {
	dir := t.TempDir()
	if !InstallationDataAvailable(dir) || InstallationDataAvailable(filepath.Join(dir, "missing")) {
		t.Fatal("数据目录缺失时必须失败，不能创建新目录")
	}
	file := filepath.Join(dir, "file")
	if err := os.WriteFile(file, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if InstallationDataAvailable(file) {
		t.Fatal("文件不能作为数据根目录")
	}
}

func TestInstallationIdentity(t *testing.T) {
	layout := InstallationInfo{InstallDir: `E:\Apps\OmniMail`, DataDir: `E:\MailData`, Locale: "en"}
	installed := resolveInstallation(layout, `e:\apps\omnimail\OmniMail.exe`, "")
	if !installed.Installed || !installed.CanAutoStart || installed.DataDir != layout.DataDir {
		t.Fatal("当前用户安装定位没有生效")
	}
	portable := resolveInstallation(layout, `E:\Other\OmniMail.exe`, "")
	if portable.Installed || portable.CanAutoStart || portable.DataDir != "" || portable.Locale != "" {
		t.Fatal("独立程序不能冒用另一安装的数据或语言")
	}
	development := resolveInstallation(layout, `E:\Apps\OmniMail\OmniMail.exe`, `E:\DevData`)
	if development.CanAutoStart {
		t.Fatal("环境隔离实例不能注册登录启动")
	}
	if !pathsOverlap(`E:\Program`, `e:\program\data`) || pathsOverlap(`E:\Program`, `E:\Program2`) {
		t.Fatal("程序/数据路径的包含判断错误")
	}
}
