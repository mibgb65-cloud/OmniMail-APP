package main

import (
	"os"
	"path/filepath"
	"strings"

	"omnimail/internal/apperr"
)

// PickLocalImages 打开系统原生图片选择框，仅过滤常用安全图片格式。
func (s *DesktopService) PickLocalImages(title string, multi bool) ([]PickedFileInfo, error) {
	app, win := s.runtimeHandles()
	if app == nil {
		return nil, apperr.New(apperr.CodeInternal, "当前不处于桌面窗口环境")
	}
	if strings.TrimSpace(title) == "" {
		title = "选择要插入的图片"
	}
	dlg := app.Dialog.OpenFile().
		SetTitle(title).
		CanChooseFiles(true).
		CanChooseDirectories(false).
		AddFilter("图片文件 (*.png;*.jpg;*.jpeg;*.gif;*.webp)", "*.png;*.jpg;*.jpeg;*.gif;*.webp;*.bmp")
	if win != nil {
		dlg.AttachToWindow(win)
	}
	var paths []string
	if multi {
		picked, err := dlg.PromptForMultipleSelection()
		if err != nil || len(picked) == 0 {
			return []PickedFileInfo{}, nil
		}
		paths = picked
	} else {
		picked, err := dlg.PromptForSingleSelection()
		if err != nil || picked == "" {
			return []PickedFileInfo{}, nil
		}
		paths = []string{picked}
	}
	out := make([]PickedFileInfo, 0, len(paths))
	for _, p := range paths {
		clean := filepath.Clean(p)
		st, err := os.Stat(clean)
		if err != nil || st.IsDir() {
			continue
		}
		out = append(out, PickedFileInfo{
			Path:      clean,
			Name:      filepath.Base(clean),
			SizeBytes: st.Size(),
			SizeText:  formatHumanBytes(st.Size()),
		})
	}
	return out, nil
}
