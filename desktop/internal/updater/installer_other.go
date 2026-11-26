//go:build !windows

package updater

import (
	"errors"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

func DetectLocalInstall(exePath string) LocalInstallInfo {
	cleanExe := filepath.Clean(strings.TrimSpace(exePath))
	exeDir := ""
	if cleanExe != "" && cleanExe != "." {
		exeDir = filepath.Dir(cleanExe)
	}
	return LocalInstallInfo{
		IsInstalled: false,
		InstallDir:  exeDir,
		InstallMode: "CurrentUser",
	}
}

func LaunchInstaller(_ string, _ LocalInstallInfo, _ bool) error {
	return errors.New("NSIS 静默覆盖安装仅支持 Windows 平台")
}

func RevealInstallerInExplorer(filePath string) error {
	dir := UpdatesTempDir()
	if strings.TrimSpace(filePath) != "" {
		dir = filepath.Dir(filepath.Clean(filePath))
	}
	if runtime.GOOS == "darwin" {
		return exec.Command("open", dir).Start()
	}
	return exec.Command("xdg-open", dir).Start()
}
