//go:build !windows

package diagnostics

func queryFreeDiskBytes(_ string) int64 {
	return 0
}
