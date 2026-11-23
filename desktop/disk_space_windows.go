//go:build windows

package main

import (
	"os"
	"path/filepath"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

func queryVolumeSpace(targetPath string) (freeBytes uint64, totalBytes uint64) {
	probe := filepath.Clean(targetPath)
	for {
		if info, err := os.Stat(probe); err == nil && info.IsDir() {
			break
		}
		parent := filepath.Dir(probe)
		if parent == probe {
			break
		}
		probe = parent
	}
	ptr, err := windows.UTF16PtrFromString(probe)
	if err != nil {
		return 0, 0
	}
	var freeAvail, total, totalFree uint64
	if err := windows.GetDiskFreeSpaceEx(ptr, &freeAvail, &total, &totalFree); err != nil {
		return 0, 0
	}
	return freeAvail, total
}

func detectSystemDarkTheme() bool {
	key, err := registry.OpenKey(
		registry.CURRENT_USER,
		`Software\Microsoft\Windows\CurrentVersion\Themes\Personalize`,
		registry.QUERY_VALUE,
	)
	if err != nil {
		return false
	}
	defer key.Close()
	val, _, err := key.GetIntegerValue("AppsUseLightTheme")
	if err != nil {
		return false
	}
	return val == 0
}

func syncDataDirRegistryHint(dataDir string) {
	key, _, err := registry.CreateKey(
		registry.CURRENT_USER,
		`Software\OmniMail`,
		registry.SET_VALUE,
	)
	if err != nil {
		return
	}
	defer key.Close()
	_ = key.SetStringValue("DataDir", dataDir)
}
