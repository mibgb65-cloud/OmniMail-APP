//go:build windows

package platform

import (
	"os"
	"path/filepath"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

// InstallationRegistryKey 仅由受控打包过程注入；开发安装不能覆盖正式版定位记录。
var InstallationRegistryKey = `Software\OmniMail\Installation`

const startupKey = `Software\Microsoft\Windows\CurrentVersion\Run`

func readInstallation() (InstallationInfo, error) {
	legacy, marker := "", ""
	const uninstall = `Software\Microsoft\Windows\CurrentVersion\Uninstall\`
	switch InstallationRegistryKey {
	case `Software\OmniMail\Installation`:
		legacy, marker = `Software\OmniMail`, uninstall+`{C6F30D51-7B7C-4DA3-88C1-7C257A168160}_is1`
	case `Software\OmniMail-Development\Installation`:
		legacy, marker = `Software\OmniMail-Development`, uninstall+`{33D8613D-72FB-412E-9838-C694DF14655E}_is1`
	}
	return readInstallationKeys(InstallationRegistryKey, legacy, marker)
}

func readInstallationKeys(primary, legacy, marker string) (InstallationInfo, error) {
	key, err := registry.OpenKey(registry.CURRENT_USER, primary, registry.QUERY_VALUE)
	if err == registry.ErrNotExist {
		if legacy == "" {
			return InstallationInfo{}, nil
		}
		// 只有匹配本产品 AppId 的卸载记录才能证明旧父键属于安装器；开发运行也会创建该父键。
		proof, proofErr := registry.OpenKey(registry.CURRENT_USER, marker, registry.QUERY_VALUE)
		if proofErr == registry.ErrNotExist {
			return InstallationInfo{}, nil
		}
		if proofErr != nil {
			return InstallationInfo{}, ErrInstallation
		}
		if proof.Close() != nil {
			return InstallationInfo{}, ErrInstallation
		}
		key, err = registry.OpenKey(registry.CURRENT_USER, legacy, registry.QUERY_VALUE)
	}
	if err != nil {
		return InstallationInfo{}, ErrInstallation
	}
	defer key.Close()
	dir, _, err := key.GetStringValue("InstallDir")
	if err != nil {
		return InstallationInfo{}, ErrInstallation
	}
	data, _, err := key.GetStringValue("DataDir")
	if err != nil {
		return InstallationInfo{}, ErrInstallation
	}
	locale, _, localeErr := key.GetStringValue("Language")
	if localeErr != nil && localeErr != registry.ErrNotExist {
		return InstallationInfo{}, ErrInstallation
	}
	if !safeInstallPath(dir) || !safeInstallPath(data) || pathsOverlap(dir, data) {
		return InstallationInfo{}, ErrInstallation
	}
	if locale != "zh-CN" && locale != "en" {
		locale = ""
	}
	result := InstallationInfo{InstallDir: filepath.Clean(dir), DataDir: filepath.Clean(data), Locale: locale}
	run, err := registry.OpenKey(registry.CURRENT_USER, startupKey, registry.QUERY_VALUE)
	if err == registry.ErrNotExist {
		return result, nil
	}
	if err != nil {
		return InstallationInfo{}, ErrInstallation
	}
	defer run.Close()
	value, _, err := run.GetStringValue(startupValueName())
	if err != nil && err != registry.ErrNotExist {
		return InstallationInfo{}, ErrInstallation
	}
	result.AutoStart = value == startupCommand(result.InstallDir)
	return result, nil
}
func safeInstallPath(value string) bool {
	clean := filepath.Clean(value)
	if len(value) < 4 || len(value) > 240 || !utf8.ValidString(value) || !filepath.IsAbs(clean) || filepath.Dir(clean) == clean ||
		strings.ContainsFunc(value, unicode.IsControl) || strings.ContainsAny(value, `"<>|?*`) || strings.HasPrefix(value, `\\`) ||
		value[1:3] != `:\` || strings.Contains(value[2:], ":") || value != clean {
		return false
	}
	for _, part := range strings.Split(value[3:], `\`) {
		if part == "" || strings.HasSuffix(part, ".") || strings.HasSuffix(part, " ") {
			return false
		}
	}
	return true
}
func pathsOverlap(a, b string) bool {
	a, b = strings.ToLower(filepath.Clean(a))+`\`, strings.ToLower(filepath.Clean(b))+`\`
	return strings.HasPrefix(a, b) || strings.HasPrefix(b, a)
}
func startupCommand(dir string) string {
	return `"` + filepath.Join(dir, "OmniMail.exe") + `" --startup`
}
func startupValueName() string {
	if InstallationRegistryKey == `Software\OmniMail-Development` || InstallationRegistryKey == `Software\OmniMail-Development\Installation` {
		return "OmniMail-Development"
	}
	return "OmniMail"
}
func SetAutoStart(enabled bool) (InstallationInfo, error) {
	info, err := Installation()
	if err != nil || !info.CanAutoStart {
		return InstallationInfo{}, ErrInstallation
	}
	key, _, err := registry.CreateKey(registry.CURRENT_USER, startupKey, registry.QUERY_VALUE|registry.SET_VALUE)
	if err != nil {
		return InstallationInfo{}, ErrInstallation
	}
	defer key.Close()
	existing, _, readErr := key.GetStringValue(startupValueName())
	if readErr != nil && readErr != registry.ErrNotExist {
		return InstallationInfo{}, ErrInstallation
	}
	if existing != "" && existing != startupCommand(info.InstallDir) {
		return InstallationInfo{}, ErrInstallation
	}
	if enabled {
		err = key.SetStringValue(startupValueName(), startupCommand(info.InstallDir))
	} else {
		err = key.DeleteValue(startupValueName())
		if err == registry.ErrNotExist {
			err = nil
		}
	}
	if err != nil {
		return InstallationInfo{}, ErrInstallation
	}
	return Installation()
}
func InstallationDataAvailable(dir string) bool {
	if !safeInstallPath(dir) {
		return false
	}
	volume, err := windows.UTF16PtrFromString(filepath.VolumeName(dir) + `\`)
	if err != nil || windows.GetDriveType(volume) != windows.DRIVE_FIXED {
		return false
	}
	// 注册表是外部输入；逐层拒绝 junction/symlink，避免安装后把数据悄悄重定向到其他盘。
	for path := dir; filepath.Dir(path) != path; path = filepath.Dir(path) {
		info, err := os.Lstat(path)
		if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
			return false
		}
	}
	return true
}
