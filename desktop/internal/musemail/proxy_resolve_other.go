//go:build !windows

package musemail

func readSystemProxyConfig() (systemProxyConfig, bool) {
	return systemProxyConfig{}, false
}
