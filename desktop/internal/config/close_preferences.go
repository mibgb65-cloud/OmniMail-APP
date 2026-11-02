package config

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"io"
	"os"

	"omnimail/desktop/internal/domain"
)

const closePreferencesFile = "window-close.json"

var errClosePreferences = errors.New("无法读写关闭偏好，请重试")

type ClosePreferences struct{ dataDir string }

func NewClosePreferences(dataDir string) *ClosePreferences {
	return &ClosePreferences{dataDir: dataDir}
}

func (p *ClosePreferences) Load(ctx context.Context) (string, error) {
	if err := ctx.Err(); err != nil {
		return domain.CloseAsk, err
	}
	root, err := os.OpenRoot(p.dataDir)
	if err != nil {
		return domain.CloseAsk, errClosePreferences
	}
	defer root.Close()
	info, err := root.Lstat(closePreferencesFile)
	if errors.Is(err, os.ErrNotExist) {
		return domain.CloseAsk, nil
	}
	if err != nil || !info.Mode().IsRegular() || info.Size() > 256 {
		return domain.CloseAsk, errClosePreferences
	}
	file, err := root.Open(closePreferencesFile)
	if errors.Is(err, os.ErrNotExist) {
		return domain.CloseAsk, nil
	}
	if err != nil {
		return domain.CloseAsk, errClosePreferences
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, 257))
	var value struct {
		Mode string `json:"mode"`
	}
	if err != nil || len(data) > 256 || json.Unmarshal(data, &value) != nil || !domain.ValidCloseMode(value.Mode) {
		return domain.CloseAsk, errClosePreferences
	}
	return value.Mode, ctx.Err()
}

func (p *ClosePreferences) Save(ctx context.Context, mode string) (result error) {
	if !domain.ValidCloseMode(mode) {
		return errors.New("关闭偏好无效")
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	root, err := os.OpenRoot(p.dataDir)
	if err != nil {
		return errClosePreferences
	}
	defer root.Close()
	// 随机排他临时文件配合受根目录约束的原子替换，防止覆盖链接目标或写出半份偏好。
	name := ".window-close-" + rand.Text() + ".tmp"
	file, err := root.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return errClosePreferences
	}
	defer func() {
		// 成功替换后原名已不存在；其他清理失败必须报告，不能假装已完成写入。
		if err := root.Remove(name); err != nil && !errors.Is(err, os.ErrNotExist) {
			result = errClosePreferences
		}
	}()
	writeErr := json.NewEncoder(file).Encode(struct {
		Mode string `json:"mode"`
	}{mode})
	syncErr, closeErr := file.Sync(), file.Close()
	if writeErr != nil || syncErr != nil || closeErr != nil {
		return errClosePreferences
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := root.Rename(name, closePreferencesFile); err != nil {
		return errClosePreferences
	}
	return nil
}
