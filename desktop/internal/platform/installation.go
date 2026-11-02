package platform

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
)

type InstallationInfo struct {
	Installed    bool   `json:"installed"`
	InstallDir   string `json:"installDir"`
	DataDir      string `json:"dataDir"`
	Locale       string `json:"locale"`
	AutoStart    bool   `json:"autoStart"`
	CanAutoStart bool   `json:"canAutoStart"`
}

var ErrInstallation = errors.New("无法读取或保存安装/自启设置")

func InstalledLayout() (InstallationInfo, error) { return readInstallation() }

func Installation() (InstallationInfo, error) {
	value, err := readInstallation()
	if err != nil {
		return InstallationInfo{}, err
	}
	exe, err := os.Executable()
	if err != nil {
		return InstallationInfo{}, ErrInstallation
	}
	return resolveInstallation(value, exe, os.Getenv("OMNIMAIL_DATA_DIR")), nil
}

func resolveInstallation(value InstallationInfo, exe, override string) InstallationInfo {
	value.Installed = value.InstallDir != "" && strings.EqualFold(filepath.Clean(exe), filepath.Join(filepath.Clean(value.InstallDir), "OmniMail.exe"))
	value.CanAutoStart = value.Installed && override == ""
	if !value.Installed {
		value.DataDir = ""
		value.Locale = ""
	}
	return value
}
func StartupLaunch() bool {
	for _, arg := range os.Args[1:] {
		if arg == "--startup" {
			return true
		}
	}
	return false
}
