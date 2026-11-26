//go:build windows

package musemail

import (
	"encoding/binary"
	"sync"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	wmSetIcon      = 0x0080
	iconSmall      = 0
	iconBig        = 1
	imageIcon      = 1
	lrDefaultSize  = 0x00000040
	lrShared       = 0x00008000
	smCxIcon       = 11
	smCyIcon       = 12
	smCxSmIcon     = 49
	smCySmIcon     = 50
	rtGroupIcon    = 14
	idiApplication = 32512
)

var (
	procSendMessageW        = modUser32.NewProc("SendMessageW")
	procLoadImageW          = modUser32.NewProc("LoadImageW")
	procLoadIconW           = modUser32.NewProc("LoadIconW")
	procCreateIconFromResEx = modUser32.NewProc("CreateIconFromResourceEx")
	procEnumResourceNamesW  = modKernel32.NewProc("EnumResourceNamesW")

	appIconsOnce  sync.Once
	cachedBigIcon windows.Handle
	cachedSmIcon  windows.Handle
)

func resolveProcessAppIcons() (bigIcon windows.Handle, smIcon windows.Handle) {
	appIconsOnce.Do(func() {
		hInst, _, _ := procGetModuleHandleW.Call(0)
		bigW := metricOrDefault(smCxIcon, 32)
		bigH := metricOrDefault(smCyIcon, 32)
		smW := metricOrDefault(smCxSmIcon, 16)
		smH := metricOrDefault(smCySmIcon, 16)

		cachedBigIcon, cachedSmIcon = loadModuleResourceIcons(hInst, bigW, bigH, smW, smH)
		if cachedBigIcon == 0 || cachedSmIcon == 0 {
			if ico := getEmbeddedAppIconICO(); len(ico) > 0 {
				if cachedBigIcon == 0 {
					cachedBigIcon = createHIconFromICOBytes(ico, bigW, bigH)
				}
				if cachedSmIcon == 0 {
					cachedSmIcon = createHIconFromICOBytes(ico, smW, smH)
				}
			}
		}
		if cachedBigIcon == 0 {
			h, _, _ := procLoadIconW.Call(0, idiApplication)
			cachedBigIcon = windows.Handle(h)
		}
		if cachedSmIcon == 0 {
			cachedSmIcon = cachedBigIcon
		}
	})
	return cachedBigIcon, cachedSmIcon
}

func applyWindowAppIcons(hwnd windows.Handle) {
	if hwnd == 0 {
		return
	}
	bigIcon, smIcon := resolveProcessAppIcons()
	if smIcon != 0 {
		_, _, _ = procSendMessageW.Call(uintptr(hwnd), wmSetIcon, iconSmall, uintptr(smIcon))
	}
	if bigIcon != 0 {
		_, _, _ = procSendMessageW.Call(uintptr(hwnd), wmSetIcon, iconBig, uintptr(bigIcon))
	}
}

func metricOrDefault(idx uintptr, fallback int32) int32 {
	v, _, _ := procGetSystemMetrics.Call(idx)
	if int32(v) > 0 {
		return int32(v)
	}
	return fallback
}

func loadModuleResourceIcons(hInst uintptr, bigW, bigH, smW, smH int32) (windows.Handle, windows.Handle) {
	candidates := []uintptr{3, 1, 101}
	var enumID uintptr
	if procEnumResourceNamesW.Find() == nil {
		cb := syscall.NewCallback(func(_ uintptr, _ uintptr, lpszName uintptr, _ uintptr) uintptr {
			if lpszName != 0 && (lpszName>>16) == 0 {
				enumID = lpszName
				return 0
			}
			return 1
		})
		_, _, _ = procEnumResourceNamesW.Call(hInst, rtGroupIcon, cb, 0)
	}
	if enumID != 0 {
		candidates = append([]uintptr{enumID}, candidates...)
	}
	for _, id := range candidates {
		bigHnd, _, _ := procLoadImageW.Call(hInst, id, imageIcon, uintptr(bigW), uintptr(bigH), lrShared)
		smHnd, _, _ := procLoadImageW.Call(hInst, id, imageIcon, uintptr(smW), uintptr(smH), lrShared)
		if bigHnd != 0 || smHnd != 0 {
			if bigHnd == 0 {
				bigHnd = smHnd
			}
			if smHnd == 0 {
				smHnd = bigHnd
			}
			return windows.Handle(bigHnd), windows.Handle(smHnd)
		}
	}
	return 0, 0
}

func createHIconFromICOBytes(data []byte, desiredW, desiredH int32) windows.Handle {
	if len(data) < 22 || binary.LittleEndian.Uint16(data[0:2]) != 0 || binary.LittleEndian.Uint16(data[2:4]) != 1 {
		return 0
	}
	count := int(binary.LittleEndian.Uint16(data[4:6]))
	if count <= 0 || len(data) < 6+count*16 {
		return 0
	}
	bestIdx := -1
	bestDiff := int32(1 << 20)
	for i := 0; i < count; i++ {
		off := 6 + i*16
		w, h := int32(data[off]), int32(data[off+1])
		if w == 0 {
			w = 256
		}
		if h == 0 {
			h = 256
		}
		diff := absInt32(w-desiredW) + absInt32(h-desiredH)
		if bestIdx < 0 || diff < bestDiff {
			bestIdx, bestDiff = i, diff
		}
	}
	if bestIdx < 0 {
		return 0
	}
	entry := data[6+bestIdx*16 : 6+(bestIdx+1)*16]
	imgSize := binary.LittleEndian.Uint32(entry[8:12])
	imgOff := binary.LittleEndian.Uint32(entry[12:16])
	if imgSize == 0 || uint64(imgOff)+uint64(imgSize) > uint64(len(data)) {
		return 0
	}
	slice := data[imgOff : imgOff+imgSize]
	hIcon, _, _ := procCreateIconFromResEx.Call(
		uintptr(unsafe.Pointer(&slice[0])),
		uintptr(imgSize),
		1,
		0x00030000,
		uintptr(desiredW),
		uintptr(desiredH),
		lrDefaultSize,
	)
	return windows.Handle(hIcon)
}

func absInt32(v int32) int32 {
	if v < 0 {
		return -v
	}
	return v
}
