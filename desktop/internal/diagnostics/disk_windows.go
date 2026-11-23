//go:build windows

package diagnostics

import (
	"os"
	"path/filepath"

	"golang.org/x/sys/windows"
)

func queryFreeDiskBytes(targetPath string) int64 {
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
		return 0
	}
	var freeAvail, total, totalFree uint64
	if err := windows.GetDiskFreeSpaceEx(ptr, &freeAvail, &total, &totalFree); err != nil {
		return 0
	}
	return int64(freeAvail)
}
