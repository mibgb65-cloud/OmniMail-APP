package repository

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"strings"

	"omnimail/desktop/internal/domain"
)

type aiCacheFile struct {
	Format string          `json:"format"`
	Result domain.AIResult `json:"result"`
}

func (s *AIStore) ReadAICache(ctx context.Context, key string) (domain.AIResult, bool, error) {
	s.files.mu.Lock()
	defer s.files.mu.Unlock()
	var file aiCacheFile
	if !validTranslationKey(key) {
		return file.Result, false, domain.ErrAIInput
	}
	found, err := s.files.read(ctx, "ai-results/"+key+".json", 1<<20, &file)
	if err != nil {
		return file.Result, false, domain.ErrAIStorage
	}
	if found && (file.Format != domain.AIFormat || !validTranslationKey(file.Result.SourceHash) ||
		!domain.ValidAccountID(file.Result.MailID) || !domain.ValidAccountID(file.Result.AccountID) || !domain.ValidAccountID(file.Result.Revision)) {
		return domain.AIResult{}, false, domain.ErrAIStorage
	}
	return file.Result, found, nil
}
func (s *AIStore) WriteAICache(ctx context.Context, key string, result domain.AIResult) error {
	if !validTranslationKey(key) {
		return domain.ErrAIInput
	}
	s.files.mu.Lock()
	defer s.files.mu.Unlock()
	if s.files.write(ctx, "ai-results/"+key+".json", aiCacheFile{domain.AIFormat, result}) != nil {
		return domain.ErrAIStorage
	}
	return nil
}

func (s *AIStore) ClearAICache(ctx context.Context) error {
	s.files.mu.Lock()
	defer s.files.mu.Unlock()
	return clearResultFiles(ctx, s.files.dir, "ai-results")
}
func (s *TranslationStore) ClearCache(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return clearResultFiles(ctx, s.dir, "translations")
}

func validResultTemp(name string) bool {
	if !strings.HasPrefix(name, ".translation-") || !strings.HasSuffix(name, ".tmp") {
		return false
	}
	token := strings.TrimSuffix(strings.TrimPrefix(name, ".translation-"), ".tmp")
	return len(token) == 26 && domain.ValidAccountID(token)
}

// 仅逐个删除哈希 JSON 和已知格式的中断临时文件；不递归、不跟随链接、不接收 UI 路径。
func clearResultFiles(ctx context.Context, directory, category string) error {
	if ctx.Err() != nil {
		return ctx.Err()
	}
	root, err := os.OpenRoot(directory)
	if err != nil {
		return domain.ErrAIStorage
	}
	defer root.Close()
	info, err := root.Lstat(category)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil || !info.IsDir() || info.Mode()&fs.ModeSymlink != 0 {
		return domain.ErrAIStorage
	}
	entries, err := fs.ReadDir(root.FS(), category)
	if err != nil {
		return domain.ErrAIStorage
	}
	for _, entry := range entries {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if strings.HasSuffix(entry.Name(), ".json") && validTranslationKey(strings.TrimSuffix(entry.Name(), ".json")) || validResultTemp(entry.Name()) {
			name := category + "/" + entry.Name()
			info, err := root.Lstat(name)
			if err != nil || !info.Mode().IsRegular() {
				return domain.ErrAIStorage
			}
			if root.Remove(name) != nil {
				return domain.ErrAIStorage
			}
		}
	}
	return nil
}
