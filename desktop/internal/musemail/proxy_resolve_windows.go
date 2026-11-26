//go:build windows

package musemail

import (
	"strings"

	"golang.org/x/sys/windows/registry"
)

const winInternetSettingsKeyPath = `Software\Microsoft\Windows\CurrentVersion\Internet Settings`

func readSystemProxyConfig() (systemProxyConfig, bool) {
	k, err := registry.OpenKey(registry.CURRENT_USER, winInternetSettingsKeyPath, registry.QUERY_VALUE)
	if err != nil {
		return systemProxyConfig{}, false
	}
	defer k.Close()

	enabledVal, _, err := k.GetIntegerValue("ProxyEnable")
	if err != nil || enabledVal != 1 {
		return systemProxyConfig{}, true
	}
	serverVal, _, err := k.GetStringValue("ProxyServer")
	if err != nil || strings.TrimSpace(serverVal) == "" {
		return systemProxyConfig{}, true
	}
	overrideVal, _, _ := k.GetStringValue("ProxyOverride")
	return systemProxyConfig{
		Enabled:  true,
		Server:   strings.TrimSpace(serverVal),
		Override: strings.TrimSpace(overrideVal),
	}, true
}
