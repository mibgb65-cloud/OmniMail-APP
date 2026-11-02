//go:build !windows

package platform

import "os"

func readInstallation() (InstallationInfo, error) { return InstallationInfo{}, nil }
func SetAutoStart(bool) (InstallationInfo, error) { return InstallationInfo{}, ErrInstallation }
func InstallationDataAvailable(dir string) bool {
	info, err := os.Stat(dir)
	return err == nil && info.IsDir()
}
