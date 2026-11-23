//go:build windows

package main

import (
	"os/exec"
	"strings"
	"syscall"
)

// showPrivacySystemToast 发送不携带邮件正文摘要的 Windows 原生隐私通知。
func showPrivacySystemToast(title, subtitle string) {
	safeEscape := func(s string) string {
		r := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", "\"", "&quot;", "'", "''")
		return r.Replace(strings.TrimSpace(s))
	}
	t := safeEscape(title)
	sub := safeEscape(subtitle)
	ps := `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null;` +
		`$xml = New-Object Windows.Data.Xml.Dom.XmlDocument;` +
		`$xml.LoadXml('<toast><visual><binding template="ToastGeneric"><text>` + t + `</text><text>` + sub + `</text></binding></visual></toast>');` +
		`$toast = [Windows.UI.Notifications.ToastNotification]::new($xml);` +
		`[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('OmniMail').Show($toast);`

	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", ps)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	_ = cmd.Start()
}
