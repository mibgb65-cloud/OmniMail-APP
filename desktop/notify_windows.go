//go:build windows

package main

import (
	"context"
	"encoding/base64"
	"encoding/xml"
	"errors"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

const windowsToastAppID = "OmniMail"

// 命令只包含固定的 WinRT 调用；邮件元数据作为 Base64 编码的 UTF-8 XML 从标准输入传入。
const windowsToastScript = `
$ErrorActionPreference = 'Stop'
$null = [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime]
$null = [Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType=WindowsRuntime]
$null = [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType=WindowsRuntime]
$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('` + windowsToastAppID + `')
# 新通知身份的 Setting 可能尚不存在；这不是拒绝，交给 Show 确认提交结果。
$setting = ''
try { $setting = [string]$notifier.Setting } catch {}
switch ($setting) {
	'DisabledForApplication' { exit 10 }
	'DisabledForUser' { exit 10 }
	'DisabledByGroupPolicy' { exit 11 }
	'DisabledByManifest' { exit 12 }
}
$document = New-Object Windows.Data.Xml.Dom.XmlDocument
$document.LoadXml([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([Console]::In.ReadToEnd())))
$toast = [Windows.UI.Notifications.ToastNotification]::new($document)
$notifier.Show($toast)
`

// showPrivacySystemToast 提交不含邮件正文的通知，成功并不保证 Windows 显示横幅。
func showPrivacySystemToast(ctx context.Context, title, subtitle string) error {
	if err := registerWindowsToastApp(); err != nil {
		return errors.New("无法在 Windows 注册 OmniMail 的通知身份，请检查当前用户的系统权限")
	}
	systemDir, err := windows.GetSystemDirectory()
	if err != nil {
		return errors.New("无法定位 Windows 通知组件")
	}
	payload, err := windowsToastXML(title, subtitle)
	if err != nil {
		return errors.New("无法生成通知内容")
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	powerShell := filepath.Join(systemDir, "WindowsPowerShell", "v1.0", "powershell.exe")
	cmd := exec.CommandContext(ctx, powerShell, "-NoProfile", "-NonInteractive", "-Command", windowsToastScript)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: windows.CREATE_NO_WINDOW}
	cmd.Stdin = strings.NewReader(base64.StdEncoding.EncodeToString(payload))
	if err := cmd.Run(); err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return errors.New("Windows 通知服务响应超时，请稍后重试")
		}
		// 不返回子进程的输出，避免诊断信息带出邮件标题等隐私数据。
		return windowsToastExitError(cmd.ProcessState.ExitCode())
	}
	return nil
}

func registerWindowsToastApp() error {
	// 不依赖安装器是否创建了开始菜单快捷方式，开发版也使用相同的通知身份。
	key, _, err := registry.CreateKey(registry.CURRENT_USER, `Software\Classes\AppUserModelId\`+windowsToastAppID, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer key.Close()
	if err := key.SetStringValue("DisplayName", windowsToastAppID); err != nil {
		return err
	}
	return key.SetDWordValue("ShowInSettings", 1)
}

func windowsToastExitError(exitCode int) error {
	switch exitCode {
	case 10:
		return errors.New("Windows 通知已禁用，请在「设置 → 系统 → 通知」中开启通知及 OmniMail 的通知权限")
	case 11:
		return errors.New("Windows 通知被设备管理策略禁用，请联系管理员")
	default:
		return errors.New("Windows 未接受这条通知，请检查「设置 → 系统 → 通知」后重试")
	}
}

type windowsToastDocument struct {
	XMLName xml.Name `xml:"toast"`
	Binding struct {
		Template string   `xml:"template,attr"`
		Text     []string `xml:"text"`
	} `xml:"visual>binding"`
}

func windowsToastXML(title, subtitle string) ([]byte, error) {
	var doc windowsToastDocument
	doc.Binding.Template = "ToastGeneric"
	doc.Binding.Text = []string{limitToastText(title, 120), limitToastText(subtitle, 240)}
	return xml.Marshal(doc)
}

func limitToastText(text string, maxRunes int) string {
	text = strings.TrimSpace(text)
	count := 0
	for pos := range text {
		if count == maxRunes {
			return text[:pos] + "…"
		}
		count++
	}
	return text
}
