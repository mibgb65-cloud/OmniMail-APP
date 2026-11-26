//go:build windows

package musemail

import (
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	wmGetMinMaxInfo       = 0x0024
	wmDpiChanged          = 0x02E0
	monitorDefaultNearest = 2
	swpNoZOrder           = 0x0004
	swpNoActivate         = 0x0010
)

var (
	procGetDpiForWindow    = modUser32.NewProc("GetDpiForWindow")
	procGetDpiForSystem    = modUser32.NewProc("GetDpiForSystem")
	procGetForegroundWin   = modUser32.NewProc("GetForegroundWindow")
	procGetWindowRect      = modUser32.NewProc("GetWindowRect")
	procIsWindowVisible    = modUser32.NewProc("IsWindowVisible")
	procIsIconic           = modUser32.NewProc("IsIconic")
	procEnumWindows        = modUser32.NewProc("EnumWindows")
	procGetWinThreadProcID = modUser32.NewProc("GetWindowThreadProcessId")
	procMonitorFromWindow  = modUser32.NewProc("MonitorFromWindow")
	procMonitorFromPoint   = modUser32.NewProc("MonitorFromPoint")
	procGetMonitorInfoW    = modUser32.NewProc("GetMonitorInfoW")
	procRtlMoveMemory      = modKernel32.NewProc("RtlMoveMemory")
)

type winPoint struct {
	X, Y int32
}

type minMaxInfo struct {
	Reserved     winPoint
	MaxSize      winPoint
	MaxPosition  winPoint
	MinTrackSize winPoint
	MaxTrackSize winPoint
}

type monitorInfo struct {
	Size    uint32
	Monitor winRect
	Work    winRect
	Flags   uint32
}

func queryWindowDPI(hwnd windows.Handle) uint32 {
	if hwnd != 0 && procGetDpiForWindow.Find() == nil {
		if d, _, _ := procGetDpiForWindow.Call(uintptr(hwnd)); d >= 96 && d <= 480 {
			return uint32(d)
		}
	}
	if procGetDpiForSystem.Find() == nil {
		if d, _, _ := procGetDpiForSystem.Call(); d >= 96 && d <= 480 {
			return uint32(d)
		}
	}
	return 96
}

func findOmniMailMainHWND() windows.Handle {
	selfPID := windows.GetCurrentProcessId()
	if fg, _, _ := procGetForegroundWin.Call(); fg != 0 && isProcessVisibleMainWin(fg, selfPID) {
		return windows.Handle(fg)
	}
	var found windows.Handle
	cb := syscall.NewCallback(func(hwnd uintptr, _ uintptr) uintptr {
		if isProcessVisibleMainWin(hwnd, selfPID) {
			found = windows.Handle(hwnd)
			return 0
		}
		return 1
	})
	_, _, _ = procEnumWindows.Call(cb, 0)
	return found
}

func isProcessVisibleMainWin(hwnd uintptr, selfPID uint32) bool {
	if _, registered := hwndRegistry.Load(windows.Handle(hwnd)); registered {
		return false
	}
	var pid uint32
	_, _, _ = procGetWinThreadProcID.Call(hwnd, uintptr(unsafe.Pointer(&pid)))
	if pid != selfPID {
		return false
	}
	vis, _, _ := procIsWindowVisible.Call(hwnd)
	ico, _, _ := procIsIconic.Call(hwnd)
	if vis == 0 || ico != 0 {
		return false
	}
	var rc winRect
	if ok, _, _ := procGetWindowRect.Call(hwnd, uintptr(unsafe.Pointer(&rc))); ok == 0 {
		return false
	}
	return (rc.Right-rc.Left) >= 640 && (rc.Bottom-rc.Top) >= 480
}

func resolveLoginPlacement() (posX, posY, winW, winH int32) {
	mainHWND := findOmniMailMainHWND()
	dpi := queryWindowDPI(mainHWND)
	winW = scaleByDPI(loginBaseWidthLogical, dpi)
	winH = scaleByDPI(loginBaseHeightLogical, dpi)

	var mainRc *winRect
	var hMon uintptr
	if mainHWND != 0 {
		var rc winRect
		if ok, _, _ := procGetWindowRect.Call(uintptr(mainHWND), uintptr(unsafe.Pointer(&rc))); ok != 0 {
			mainRc = &rc
		}
		hMon, _, _ = procMonitorFromWindow.Call(uintptr(mainHWND), monitorDefaultNearest)
	} else {
		hMon, _, _ = procMonitorFromPoint.Call(0, monitorDefaultNearest)
	}

	workArea := fallbackScreenWorkArea()
	if hMon != 0 {
		mi := monitorInfo{Size: uint32(unsafe.Sizeof(monitorInfo{}))}
		if ok, _, _ := procGetMonitorInfoW.Call(hMon, uintptr(unsafe.Pointer(&mi))); ok != 0 {
			workArea = mi.Work
		}
	}
	posX, posY = computeSmartLoginPosition(workArea, mainRc, winW, winH)
	return posX, posY, winW, winH
}

func fallbackScreenWorkArea() winRect {
	sw, _, _ := procGetSystemMetrics.Call(smCxScreen)
	sh, _, _ := procGetSystemMetrics.Call(smCyScreen)
	if int32(sw) <= 0 || int32(sh) <= 0 {
		return winRect{Left: 0, Top: 0, Right: 1920, Bottom: 1040}
	}
	return winRect{Left: 0, Top: 0, Right: int32(sw), Bottom: int32(sh)}
}

func applyMinTrackSize(hwnd windows.Handle, lParam uintptr) {
	if lParam == 0 {
		return
	}
	dpi := queryWindowDPI(hwnd)
	pt := winPoint{
		X: scaleByDPI(loginMinWidthLogical, dpi),
		Y: scaleByDPI(loginMinHeightLogical, dpi),
	}
	offset := unsafe.Offsetof(minMaxInfo{}.MinTrackSize)
	_, _, _ = procRtlMoveMemory.Call(lParam+offset, uintptr(unsafe.Pointer(&pt)), unsafe.Sizeof(pt))
}

func applySuggestedDPIRect(hwnd uintptr, lParam uintptr) {
	if hwnd == 0 || lParam == 0 {
		return
	}
	var sug winRect
	_, _, _ = procRtlMoveMemory.Call(uintptr(unsafe.Pointer(&sug)), lParam, unsafe.Sizeof(sug))
	_, _, _ = procSetWindowPos.Call(
		hwnd, 0,
		uintptr(sug.Left), uintptr(sug.Top),
		uintptr(sug.Right-sug.Left), uintptr(sug.Bottom-sug.Top),
		swpNoZOrder|swpNoActivate,
	)
}
