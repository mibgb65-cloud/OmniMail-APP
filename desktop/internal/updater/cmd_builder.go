package updater

import "strings"

// NormalizeInstallModeFlag 将注册表 InstallMode 转换为 NSIS MultiUser 参数。
func NormalizeInstallModeFlag(mode string) string {
	if strings.EqualFold(strings.TrimSpace(mode), "AllUsers") {
		return "/AllUsers"
	}
	return "/CurrentUser"
}

// BuildNSISArgs 返回 NSIS 安装参数切片（/D= 严格保持最后一个参数且不加额外引号）。
func BuildNSISArgs(installMode string, installDir string, silent bool) []string {
	modeFlag := NormalizeInstallModeFlag(installMode)
	cleanDir := strings.TrimSpace(installDir)
	args := make([]string, 0, 4)
	if silent {
		args = append(args, "/S", "/RELAUNCH")
	}
	args = append(args, modeFlag)
	if cleanDir != "" {
		args = append(args, "/D="+cleanDir)
	}
	return args
}

// BuildNSISCommandLine 构造 Windows 原始 Win32 命令行字符串，确保含空格的 /D=<installDir> 位于末尾且不被二次加引号。
func BuildNSISCommandLine(installerPath string, installMode string, installDir string, silent bool) string {
	exe := `"` + strings.Trim(strings.TrimSpace(installerPath), `"`) + `"`
	parts := []string{exe}
	parts = append(parts, BuildNSISArgs(installMode, installDir, silent)...)
	return strings.Join(parts, " ")
}
