package main

import (
	"bytes"
	_ "embed"
	"encoding/binary"
	"image/png"
	"testing"
)

//go:embed frontend/public/brand/omnimail.ico
var windowsIcon []byte

func TestEmbeddedApplicationIcon(t *testing.T) {
	config, err := png.DecodeConfig(bytes.NewReader(appIcon))
	if err != nil {
		t.Fatalf("嵌入的应用图标不是有效 PNG: %v", err)
	}
	if config.Width != 256 || config.Height != 256 {
		t.Fatalf("原生窗口备用图标应为 256×256，实际为 %d×%d", config.Width, config.Height)
	}
}

func TestEmbeddedApplicationIconUsesTransparentStandard(t *testing.T) {
	icon, err := png.Decode(bytes.NewReader(appIcon))
	if err != nil {
		t.Fatalf("无法解码应用图标: %v", err)
	}
	// 顶部主体必须是蓝色，防止再次把示意图的白色底座合成进资源。
	r, _, b, a := icon.At(128, 12).RGBA()
	if b <= r || a != 0xffff {
		t.Error("原生图标不应添加白色底座或白边")
	}
	_, _, _, cornerAlpha := icon.At(0, 0).RGBA()
	if cornerAlpha != 0 {
		t.Error("蓝色图标圆角外必须保持透明")
	}
	r, _, b, a = icon.At(128, 40).RGBA()
	if b <= r || a != 0xffff {
		t.Error("图标应保留不透明的蓝色主体")
	}
}

func TestWindowsIconSizesUseTransparentStandard(t *testing.T) {
	if len(windowsIcon) < 6 || binary.LittleEndian.Uint16(windowsIcon[2:4]) != 1 {
		t.Fatal("Windows 图标头无效")
	}
	count := int(binary.LittleEndian.Uint16(windowsIcon[4:6]))
	expected := map[int]bool{16: true, 24: true, 32: true, 48: true, 64: true, 128: true, 256: true}
	if count != len(expected) || len(windowsIcon) < 6+16*count {
		t.Fatal("Windows 图标必须包含完整的七个尺寸")
	}
	for index := 0; index < count; index++ {
		entry := windowsIcon[6+index*16 : 6+(index+1)*16]
		size := int(entry[0])
		if size == 0 {
			size = 256
		}
		if !expected[size] || entry[0] != entry[1] {
			t.Fatalf("Windows 图标尺寸重复或无效: %d", size)
		}
		delete(expected, size)
		length := uint64(binary.LittleEndian.Uint32(entry[8:12]))
		offset := uint64(binary.LittleEndian.Uint32(entry[12:16]))
		if length == 0 || offset+length > uint64(len(windowsIcon)) {
			t.Fatal("Windows 图标图层越界")
		}
		layer, err := png.Decode(bytes.NewReader(windowsIcon[offset : offset+length]))
		if err != nil || layer.Bounds().Dx() != size || layer.Bounds().Dy() != size {
			t.Fatalf("%dpx 图标不是匹配尺寸的有效 PNG: %v", size, err)
		}
		r, _, b, a := layer.At(size/2, 0).RGBA()
		// 所有图层均从完整标准版缩放，顶部不能残留先前误加的白边。
		if a == 0 || b <= r {
			t.Errorf("%dpx 图标顶部仍有白边", size)
		}
	}
}
