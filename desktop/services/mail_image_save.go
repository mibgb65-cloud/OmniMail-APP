package services

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"

	"omnimail/internal/apperr"
	"omnimail/internal/mailproto"
)

const maxSaveImageBytes = 25 * 1024 * 1024

// SaveImageDataAs 通过系统保存对话框将 Lightbox 中的图片原数据保存至本地磁盘。
func (s *MailService) SaveImageDataAs(filename, dataOrBase64 string) (string, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return "", err
	}
	clean := strings.TrimSpace(dataOrBase64)
	if idx := strings.Index(clean, ";base64,"); idx >= 0 {
		clean = clean[idx+len(";base64,"):]
	}
	if clean == "" {
		return "", apperr.New(apperr.CodeInvalidInput, "图片数据为空")
	}
	if base64.StdEncoding.DecodedLen(len(clean)) > maxSaveImageBytes+1024 {
		return "", apperr.New(apperr.CodeInvalidInput, "图片体积超过 25 MB 上限")
	}
	raw, err := base64.StdEncoding.DecodeString(clean)
	if err != nil || len(raw) == 0 || len(raw) > maxSaveImageBytes {
		return "", apperr.New(apperr.CodeInvalidInput, "图片数据格式无效")
	}
	safeName := mailproto.SanitizeFilename(filename)
	if safeName == "attachment.bin" || !strings.Contains(safeName, ".") {
		safeName = "image.png"
	}
	target := filepath.Join(sess.ProfileDir, "exports", safeName)
	if s.app != nil {
		dlg := s.app.Dialog.SaveFile().SetMessage("保存图片").SetFilename(safeName)
		if s.win != nil {
			dlg.AttachToWindow(s.win)
		}
		picked, pErr := dlg.PromptForSingleSelection()
		if pErr != nil || picked == "" {
			return "", nil
		}
		target = picked
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o700); err != nil {
		return "", err
	}
	return target, os.WriteFile(target, raw, 0o600)
}
