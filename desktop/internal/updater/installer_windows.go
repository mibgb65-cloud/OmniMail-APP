//go:build windows

package updater

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

// DetectLocalInstall 检测当前运行的可执行文件是否位于 NSIS 安装目录，并读取注册表 InstallMode。
func DetectLocalInstall(exePath string) LocalInstallInfo {
	cleanExe := filepath.Clean(strings.TrimSpace(exePath))
	exeDir := ""
	if cleanExe != "" && cleanExe != "." {
		exeDir = filepath.Clean(filepath.Dir(cleanExe))
	}

	cuDir, cuMode := readOmniMailReg(registry.CURRENT_USER)
	lmDir, lmMode := readOmniMailReg(registry.LOCAL_MACHINE)

	if exeDir != "" {
		hasUninst := fileExists(filepath.Join(exeDir, "Uninstall.exe"))
		if cuDir != "" && strings.EqualFold(exeDir, filepath.Clean(cuDir)) {
			return LocalInstallInfo{
				IsInstalled: true,
				InstallDir:  exeDir,
				InstallMode: fallbackMode(cuMode, "CurrentUser"),
			}
		}
		if lmDir != "" && strings.EqualFold(exeDir, filepath.Clean(lmDir)) {
			return LocalInstallInfo{
				IsInstalled: true,
				InstallDir:  exeDir,
				InstallMode: fallbackMode(lmMode, "AllUsers"),
			}
		}
		if hasUninst {
			mode := cuMode
			if mode == "" {
				mode = lmMode
			}
			return LocalInstallInfo{
				IsInstalled: true,
				InstallDir:  exeDir,
				InstallMode: fallbackMode(mode, "CurrentUser"),
			}
		}
	}

	return LocalInstallInfo{
		IsInstalled: false,
		InstallDir:  exeDir,
		InstallMode: fallbackMode(cuMode, fallbackMode(lmMode, "CurrentUser")),
	}
}

func readOmniMailReg(root registry.Key) (string, string) {
	key, err := registry.OpenKey(root, `Software\OmniMail`, registry.QUERY_VALUE|registry.WOW64_64KEY)
	if err != nil {
		return "", ""
	}
	defer key.Close()
	dir, _, _ := key.GetStringValue("InstallDir")
	mode, _, _ := key.GetStringValue("InstallMode")
	return strings.TrimSpace(dir), strings.TrimSpace(mode)
}

func fallbackMode(val string, def string) string {
	if strings.EqualFold(strings.TrimSpace(val), "AllUsers") {
		return "AllUsers"
	}
	if strings.EqualFold(strings.TrimSpace(val), "CurrentUser") {
		return "CurrentUser"
	}
	return def
}

func fileExists(p string) bool {
	st, err := os.Stat(p)
	return err == nil && !st.IsDir()
}

// LaunchInstaller 启动已校验的 NSIS 安装程序（支持 UAC ShellExecute 回退）。
func LaunchInstaller(installerPath string, info LocalInstallInfo, silent bool) error {
	cleanInstaller := filepath.Clean(installerPath)
	rawCmd := BuildNSISCommandLine(cleanInstaller, info.InstallMode, info.InstallDir, silent)

	cmd := exec.Command(cleanInstaller)
	cmd.Dir = filepath.Dir(cleanInstaller)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CmdLine: rawCmd,
	}
	if err := cmd.Start(); err != nil {
		// 若 AllUsers 安装器带有管理员清单触发 ERROR_ELEVATION_REQUIRED，回退 ShellExecute runas 唤起
		argsOnly := strings.Join(BuildNSISArgs(info.InstallMode, info.InstallDir, silent), " ")
		verbPtr, _ := windows.UTF16PtrFromString("open")
		if strings.EqualFold(info.InstallMode, "AllUsers") {
			verbPtr, _ = windows.UTF16PtrFromString("runas")
		}
		filePtr, err1 := windows.UTF16PtrFromString(cleanInstaller)
		if err1 != nil {
			return err
		}
		paramPtr, err2 := windows.UTF16PtrFromString(argsOnly)
		if err2 != nil {
			return err
		}
		dirPtr, _ := windows.UTF16PtrFromString(filepath.Dir(cleanInstaller))
		if seErr := windows.ShellExecute(0, verbPtr, filePtr, paramPtr, dirPtr, windows.SW_SHOWNORMAL); seErr != nil {
			return err
		}
		return nil
	}
	_ = cmd.Process.Release()
	return nil
}

// RevealInstallerInExplorer 在 Windows 资源管理器中打开并高亮选中已下载的安装包。
func RevealInstallerInExplorer(filePath string) error {
	clean := filepath.Clean(strings.TrimSpace(filePath))
	if clean != "" && fileExists(clean) {
		cmd := exec.Command("explorer.exe", "/select,"+clean)
		if err := cmd.Start(); err == nil {
			_ = cmd.Process.Release()
			return nil
		}
	}
	dir := UpdatesTempDir()
	_ = os.MkdirAll(dir, 0o700)
	cmd := exec.Command("explorer.exe", dir)
	if err := cmd.Start(); err != nil {
		return err
	}
	_ = cmd.Process.Release()
	return nil
}
