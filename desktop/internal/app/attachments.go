package app

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"unicode"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func saveAttachment(name string, data []byte) (bool, error) {
	name = safeExportName(name)
	target, err := application.Get().Dialog.SaveFile().SetFilename(name).PromptForSingleSelection()
	if err != nil || target == "" {
		return false, err
	}
	if !safeExportTarget(target) {
		return false, errors.New("SAVE_FAILED")
	}
	return writeExport(target, data)
}

func safeExportName(name string) string {
	name = filepath.Base(strings.ReplaceAll(name, `\`, "/"))
	name = strings.Map(func(char rune) rune {
		if unicode.IsControl(char) || unicode.Is(unicode.Cf, char) || strings.ContainsRune(`<>:"/\|?*`, char) {
			return '_'
		}
		return char
	}, name)
	name = strings.Trim(name, " .")
	if name == "" || name == "." {
		name = "attachment.bin"
	}
	base := strings.ToUpper(strings.SplitN(name, ".", 2)[0])
	if base == "CON" || base == "PRN" || base == "AUX" || base == "NUL" ||
		(len(base) == 4 && (strings.HasPrefix(base, "COM") || strings.HasPrefix(base, "LPT")) && base[3] >= '1' && base[3] <= '9') {
		name = "_" + name
	}
	return name
}

func safeExportTarget(target string) bool {
	return filepath.IsAbs(target) && len(target) <= 4096 && !strings.ContainsFunc(target, unicode.IsControl) &&
		!strings.HasPrefix(target, `\\.\`) && !strings.HasPrefix(target, `\\?\`) && !strings.Contains(filepath.Base(target), ":")
}

func writeExport(target string, data []byte) (bool, error) {
	// 只允许用户在原生对话框选定的新文件；不静默覆盖已有文件或跟随已有文件符号链接。
	file, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return false, errors.New("SAVE_FAILED")
	}
	_, writeError := file.Write(data)
	closeError := file.Close()
	if errors.Join(writeError, closeError) != nil {
		if err := os.Remove(target); err != nil {
			return false, errors.New("SAVE_FAILED")
		}
		return false, errors.New("SAVE_FAILED")
	}
	return true, nil
}
