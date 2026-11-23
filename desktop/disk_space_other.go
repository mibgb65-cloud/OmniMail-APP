//go:build !windows

package main

func queryVolumeSpace(_ string) (freeBytes uint64, totalBytes uint64) {
	const fallbackGib = 64 * 1024 * 1024 * 1024
	return fallbackGib, fallbackGib * 2
}

func detectSystemDarkTheme() bool {
	return false
}

func syncDataDirRegistryHint(_ string) {}
