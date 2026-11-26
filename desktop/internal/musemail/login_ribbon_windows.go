//go:build windows

package musemail

import (
	"sync"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	wmPaint          = 0x000F
	wmEraseBkgnd     = 0x0014
	transparentBk    = 1
	nullPen          = 8
	fwNormal         = 400
	fwSemibold       = 600
	cleartypeQuality = 5
	dtSingleLine     = 0x0020
	dtVCenter        = 0x0004
	dtRight          = 0x0002
	dtEndEllipsis    = 0x8000
	dtNoPrefix       = 0x0800

	trustRibbonCopy  = "https://muse.ai · 隔离加密会话（仅当前登录有效）"
	trustRibbonBadge = "HTTPS"
)

var (
	modGdi32                   = windows.NewLazySystemDLL("gdi32.dll")
	procBeginPaint             = modUser32.NewProc("BeginPaint")
	procEndPaint               = modUser32.NewProc("EndPaint")
	procFillRect               = modUser32.NewProc("FillRect")
	procDrawTextW              = modUser32.NewProc("DrawTextW")
	procInvalidateRect         = modUser32.NewProc("InvalidateRect")
	procCreateSolidBrush       = modGdi32.NewProc("CreateSolidBrush")
	procCreateCompatibleDC     = modGdi32.NewProc("CreateCompatibleDC")
	procCreateCompatibleBitmap = modGdi32.NewProc("CreateCompatibleBitmap")
	procSelectObject           = modGdi32.NewProc("SelectObject")
	procDeleteObject           = modGdi32.NewProc("DeleteObject")
	procDeleteDC               = modGdi32.NewProc("DeleteDC")
	procBitBlt                 = modGdi32.NewProc("BitBlt")
	procSetBkMode              = modGdi32.NewProc("SetBkMode")
	procSetTextColor           = modGdi32.NewProc("SetTextColor")
	procCreateFontW            = modGdi32.NewProc("CreateFontW")
	procEllipse                = modGdi32.NewProc("Ellipse")
	procGetStockObject         = modGdi32.NewProc("GetStockObject")

	darkWndBrushOnce sync.Once
	darkWndBrush     windows.Handle
)

type paintStruct struct {
	Hdc         uintptr
	Erase       int32
	RcPaint     winRect
	Restore     int32
	IncUpdate   int32
	RgbReserved [32]byte
}

func sharedDarkWindowBrush() windows.Handle {
	darkWndBrushOnce.Do(func() {
		h, _, _ := procCreateSolidBrush.Call(colorRefWinBgDark)
		darkWndBrush = windows.Handle(h)
	})
	return darkWndBrush
}

func paintTrustRibbon(hwnd uintptr) {
	var ps paintStruct
	hdc, _, _ := procBeginPaint.Call(hwnd, uintptr(unsafe.Pointer(&ps)))
	if hdc == 0 {
		return
	}
	defer procEndPaint.Call(hwnd, uintptr(unsafe.Pointer(&ps)))

	var client winRect
	if ret, _, _ := procGetClientRect.Call(hwnd, uintptr(unsafe.Pointer(&client))); ret == 0 {
		return
	}
	dpi := queryWindowDPI(windows.Handle(hwnd))
	ribbonRc, _ := computeWebViewClientBounds(client, dpi)
	w := ribbonRc.Right - ribbonRc.Left
	h := ribbonRc.Bottom - ribbonRc.Top
	if w <= 0 || h <= 0 {
		return
	}

	memDC, _, _ := procCreateCompatibleDC.Call(hdc)
	if memDC == 0 {
		drawRibbonOnDC(hdc, ribbonRc, dpi)
		return
	}
	defer procDeleteDC.Call(memDC)

	memBmp, _, _ := procCreateCompatibleBitmap.Call(hdc, uintptr(w), uintptr(h))
	if memBmp == 0 {
		drawRibbonOnDC(hdc, ribbonRc, dpi)
		return
	}
	oldBmp, _, _ := procSelectObject.Call(memDC, memBmp)
	drawRibbonOnDC(memDC, ribbonRc, dpi)
	const srccopy = 0x00CC0020
	_, _, _ = procBitBlt.Call(hdc, 0, 0, uintptr(w), uintptr(h), memDC, 0, 0, srccopy)
	_, _, _ = procSelectObject.Call(memDC, oldBmp)
	_, _, _ = procDeleteObject.Call(memBmp)
}

func drawRibbonOnDC(dc uintptr, rc winRect, dpi uint32) {
	w := rc.Right - rc.Left
	h := rc.Bottom - rc.Top

	bgBrush, _, _ := procCreateSolidBrush.Call(colorRefRibbonBg)
	if bgBrush != 0 {
		_, _, _ = procFillRect.Call(dc, uintptr(unsafe.Pointer(&rc)), bgBrush)
		_, _, _ = procDeleteObject.Call(bgBrush)
	}
	borderH := max(int32(1), scaleByDPI(1, dpi))
	borderRc := winRect{Left: 0, Top: h - borderH, Right: w, Bottom: h}
	borderBrush, _, _ := procCreateSolidBrush.Call(colorRefRibbonBorder)
	if borderBrush != 0 {
		_, _, _ = procFillRect.Call(dc, uintptr(unsafe.Pointer(&borderRc)), borderBrush)
		_, _, _ = procDeleteObject.Call(borderBrush)
	}

	padX := scaleByDPI(14, dpi)
	dotD := max(int32(7), scaleByDPI(7, dpi))
	dotTop := (h - borderH - dotD) / 2
	dotBrush, _, _ := procCreateSolidBrush.Call(colorRefRibbonDot)
	noPen, _, _ := procGetStockObject.Call(nullPen)
	if dotBrush != 0 && noPen != 0 {
		oldB, _, _ := procSelectObject.Call(dc, dotBrush)
		oldP, _, _ := procSelectObject.Call(dc, noPen)
		_, _, _ = procEllipse.Call(dc, uintptr(padX), uintptr(dotTop), uintptr(padX+dotD), uintptr(dotTop+dotD))
		_, _, _ = procSelectObject.Call(dc, oldP)
		_, _, _ = procSelectObject.Call(dc, oldB)
		_, _, _ = procDeleteObject.Call(dotBrush)
	}

	_, _, _ = procSetBkMode.Call(dc, transparentBk)
	mainFont := createRibbonFont(dpi, 12, fwNormal, "Microsoft YaHei UI")
	badgeFont := createRibbonFont(dpi, 11, fwSemibold, "Segoe UI")
	defer func() {
		if mainFont != 0 {
			_, _, _ = procDeleteObject.Call(mainFont)
		}
		if badgeFont != 0 {
			_, _, _ = procDeleteObject.Call(badgeFont)
		}
	}()

	badgeReserve := scaleByDPI(54, dpi)
	badgeRc := winRect{Left: max(int32(0), w-padX-badgeReserve), Top: 0, Right: max(int32(0), w-padX), Bottom: h - borderH}
	if badgeFont != 0 {
		oldF, _, _ := procSelectObject.Call(dc, badgeFont)
		_, _, _ = procSetTextColor.Call(dc, colorRefRibbonBadge)
		badgeU16, _ := windows.UTF16FromString(trustRibbonBadge)
		_, _, _ = procDrawTextW.Call(dc, uintptr(unsafe.Pointer(&badgeU16[0])), ^uintptr(0), uintptr(unsafe.Pointer(&badgeRc)), dtSingleLine|dtVCenter|dtRight|dtNoPrefix)
		_, _, _ = procSelectObject.Call(dc, oldF)
	}

	textLeft := padX + dotD + scaleByDPI(7, dpi)
	textRight := max(textLeft, badgeRc.Left-scaleByDPI(8, dpi))
	textRc := winRect{Left: textLeft, Top: 0, Right: textRight, Bottom: h - borderH}
	if mainFont != 0 {
		oldF, _, _ := procSelectObject.Call(dc, mainFont)
		_, _, _ = procSetTextColor.Call(dc, colorRefRibbonText)
		copyU16, _ := windows.UTF16FromString(trustRibbonCopy)
		_, _, _ = procDrawTextW.Call(dc, uintptr(unsafe.Pointer(&copyU16[0])), ^uintptr(0), uintptr(unsafe.Pointer(&textRc)), dtSingleLine|dtVCenter|dtEndEllipsis|dtNoPrefix)
		_, _, _ = procSelectObject.Call(dc, oldF)
	}
}

func createRibbonFont(dpi uint32, px int32, weight uintptr, face string) uintptr {
	facePtr, _ := windows.UTF16PtrFromString(face)
	height := -int(scaleByDPI(px, dpi))
	f, _, _ := procCreateFontW.Call(
		uintptr(height), 0, 0, 0, weight, 0, 0, 0, 1, 0, 0, cleartypeQuality, 0,
		uintptr(unsafe.Pointer(facePtr)),
	)
	return f
}
