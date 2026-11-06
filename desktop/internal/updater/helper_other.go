//go:build !windows

package updater

func RunInstaller(string, string, int) error  { return ErrUpdate }
func StartHelper(string, Paths, string) error { return ErrUpdate }
