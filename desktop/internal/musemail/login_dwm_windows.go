//go:build windows

package musemail

import (
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	dwmwaUseImmersiveDarkModeLegacy = 19
	dwmwaUseImmersiveDarkMode       = 20
	dwmwaWindowCornerPreference     = 33
	dwmwaCaptionColor               = 35
	dwmwaTextColor                  = 36

	dwmwcpRound = 2

	// Win32 COLORREF 为 0x00BBGGRR
	colorRefCaptionDark  = 0x001C1816 // #16181C
	colorRefCaptionText  = 0x00F0E8E2 // #E2E8F0
	colorRefWinBgDark    = 0x00221F1E // #1E1F22
	colorRefRibbonBg     = 0x0030221B // #1B2230
	colorRefRibbonBorder = 0x00483226 // #263248
	colorRefRibbonDot    = 0x0081B910 // #10B981
	colorRefRibbonText   = 0x00FDC593 // #93C5FD
	colorRefRibbonBadge  = 0x008B7464 // #64748B
)

var (
	modDwmapi         = windows.NewLazySystemDLL("dwmapi.dll")
	procDwmSetWinAttr = modDwmapi.NewProc("DwmSetWindowAttribute")
)

type dwmAttrSetterFunc func(hwnd uintptr, attr uint32, val *uint32, cb uint32) uintptr

func callSystemDwmSetWindowAttribute(hwnd uintptr, attr uint32, val *uint32, cb uint32) uintptr {
	if hwnd == 0 || val == nil {
		return uintptr(windows.E_INVALIDARG)
	}
	if err := procDwmSetWinAttr.Find(); err != nil {
		return uintptr(windows.E_NOTIMPL)
	}
	hr, _, _ := procDwmSetWinAttr.Call(hwnd, uintptr(attr), uintptr(unsafe.Pointer(val)), uintptr(cb))
	return hr
}

func applyImmersiveDarkDwmAttributes(hwnd windows.Handle) {
	applyImmersiveDarkDwmWithSetter(uintptr(hwnd), callSystemDwmSetWindowAttribute)
}

// applyImmersiveDarkDwmWithSetter 注入 DWM 属性设置器；不支持某属性（如 Win10 无 33/35/36）时静默降级不 panic。
func applyImmersiveDarkDwmWithSetter(hwnd uintptr, setter dwmAttrSetterFunc) {
	if hwnd == 0 || setter == nil {
		return
	}
	const u32Size = uint32(unsafe.Sizeof(uint32(0)))

	darkOn := uint32(1)
	if hr := setter(hwnd, dwmwaUseImmersiveDarkMode, &darkOn, u32Size); int32(hr) < 0 {
		_ = setter(hwnd, dwmwaUseImmersiveDarkModeLegacy, &darkOn, u32Size)
	}

	corner := uint32(dwmwcpRound)
	_ = setter(hwnd, dwmwaWindowCornerPreference, &corner, u32Size)

	captionColor := uint32(colorRefCaptionDark)
	_ = setter(hwnd, dwmwaCaptionColor, &captionColor, u32Size)

	textColor := uint32(colorRefCaptionText)
	_ = setter(hwnd, dwmwaTextColor, &textColor, u32Size)
}
