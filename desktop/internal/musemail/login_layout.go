package musemail

type winRect struct {
	Left, Top, Right, Bottom int32
}

const (
	loginBaseWidthLogical  = 480
	loginBaseHeightLogical = 680
	loginMinWidthLogical   = 420
	loginMinHeightLogical  = 580
	trustRibbonHeightLogic = 30
)

func scaleByDPI(px int32, dpi uint32) int32 {
	if dpi == 0 {
		dpi = 96
	}
	return int32((int64(px)*int64(dpi) + 48) / 96)
}

func computeTrustRibbonHeightPx(dpi uint32) int32 {
	h := scaleByDPI(trustRibbonHeightLogic, dpi)
	if h < trustRibbonHeightLogic {
		return trustRibbonHeightLogic
	}
	return h
}

func computeWebViewClientBounds(client winRect, dpi uint32) (ribbonRect winRect, webviewRect winRect) {
	headerH := computeTrustRibbonHeightPx(dpi)
	w := client.Right - client.Left
	h := client.Bottom - client.Top
	if w < 0 {
		w = 0
	}
	if h < 0 {
		h = 0
	}
	ribbonBottom := headerH
	if ribbonBottom > h {
		ribbonBottom = h
	}
	ribbonRect = winRect{Left: 0, Top: 0, Right: w, Bottom: ribbonBottom}
	webviewRect = winRect{Left: 0, Top: ribbonBottom, Right: w, Bottom: h}
	return ribbonRect, webviewRect
}

// computeSmartLoginPosition 将独立登录窗口智能定位在主窗口居中偏左位置并做显示器工作区边界夹紧，避免完全遮挡右侧「连接 Muse Mail」验证卡。
func computeSmartLoginPosition(workArea winRect, mainRect *winRect, winW, winH int32) (posX, posY int32) {
	workW := workArea.Right - workArea.Left
	workH := workArea.Bottom - workArea.Top
	if workW <= 0 || workH <= 0 {
		return 120, 100
	}
	if mainRect != nil && (mainRect.Right-mainRect.Left) >= 480 && (mainRect.Bottom-mainRect.Top) >= 360 {
		mainW := mainRect.Right - mainRect.Left
		mainH := mainRect.Bottom - mainRect.Top
		// 对齐 OpenPencil 261906429:159：锚定主窗口左半区，预留右侧验证与连接状态列可视空间
		offsetX := max(int32(32), mainW/9)
		posX = mainRect.Left + offsetX
		posY = mainRect.Top + (mainH-winH)/2
	} else {
		posX = workArea.Left + (workW-winW)/2
		posY = workArea.Top + (workH-winH)/2
	}

	margin := int32(12)
	minX := workArea.Left + margin
	maxX := workArea.Right - winW - margin
	if maxX < minX {
		posX = workArea.Left + max(int32(0), (workW-winW)/2)
	} else {
		posX = min(max(posX, minX), maxX)
	}

	minY := workArea.Top + margin
	maxY := workArea.Bottom - winH - margin
	if maxY < minY {
		posY = workArea.Top + max(int32(0), (workH-winH)/2)
	} else {
		posY = min(max(posY, minY), maxY)
	}
	return posX, posY
}
