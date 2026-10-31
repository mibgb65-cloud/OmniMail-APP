package app

import (
	"os"
	"path/filepath"
	"testing"
)

func TestAttachmentExportNamesAndTargets(t *testing.T) {
	for _, name := range []string{`..\..\file.txt`, "../../file.txt"} {
		if safeExportName(name) != "file.txt" {
			t.Fatal("远端路径未剥离")
		}
	}
	if safeExportName("CON.txt") != "_CON.txt" || safeExportName("safe\u202Eexe.txt") != "safe_exe.txt" {
		t.Fatal("设备名或双向文本控制未处理")
	}
	for _, target := range []string{"relative", "C:\\bad\x00file", `\\.\CON`, `\\?\C:\outside`, `C:\folder\file.txt:stream`} {
		if safeExportTarget(target) {
			t.Fatal("不安全导出目标被接受")
		}
	}
	path := filepath.Join(t.TempDir(), "new.txt")
	if !safeExportTarget(path) {
		t.Fatal("正常目标被拒绝")
	}
	if saved, err := writeExport(path, []byte("first")); err != nil || !saved {
		t.Fatal("未写入用户选定的新文件")
	}
	if _, err := writeExport(path, []byte("overwrite")); err == nil {
		t.Fatal("静默覆盖了已有文件")
	}
	data, err := os.ReadFile(path)
	if err != nil || string(data) != "first" {
		t.Fatal("原文件被改写")
	}
}
