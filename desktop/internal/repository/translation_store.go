package repository

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"os"
	"sort"
	"strings"
	"sync"

	"omnimail/desktop/internal/domain"
)

type TranslationStore struct {
	dir string
	mu  sync.Mutex
}

func NewTranslationStore(dir string) *TranslationStore { return &TranslationStore{dir: dir} }

type translationPrefsFile struct {
	Version     int                           `json:"version"`
	Preferences domain.TranslationPreferences `json:"preferences"`
}
type translationCacheFile struct {
	Format string                   `json:"format"`
	Result domain.TranslationResult `json:"result"`
}

func validTranslationKey(key string) bool {
	data, err := hex.DecodeString(key)
	return err == nil && len(data) == 32 && strings.ToLower(key) == key
}
func (s *TranslationStore) Preferences(ctx context.Context) (domain.TranslationPreferences, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var file translationPrefsFile
	found, err := s.read(ctx, "translation-preferences.json", 1024, &file)
	if err != nil {
		return domain.TranslationPreferences{}, err
	}
	if !found {
		return domain.TranslationPreferences{Target: "zh"}, nil
	}
	if file.Version != 1 || domain.TranslationLanguage(file.Preferences.Target) == "" {
		return domain.TranslationPreferences{}, domain.ErrTranslationStorage
	}
	return file.Preferences, nil
}
func (s *TranslationStore) SavePreferences(ctx context.Context, prefs domain.TranslationPreferences) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if domain.TranslationLanguage(prefs.Target) == "" {
		return domain.ErrTranslationInput
	}
	return s.write(ctx, "translation-preferences.json", translationPrefsFile{1, prefs})
}
func (s *TranslationStore) ReadCache(ctx context.Context, key string) (domain.TranslationResult, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !validTranslationKey(key) {
		return domain.TranslationResult{}, false, domain.ErrTranslationInput
	}
	var file translationCacheFile
	found, err := s.read(ctx, "translations/"+key+".json", 1<<20, &file)
	if err != nil || !found {
		return domain.TranslationResult{}, false, err
	}
	r := file.Result
	if file.Format != domain.TranslationFormat || !domain.ValidAccountID(r.MailID) || !validTranslationKey(r.SourceHash) ||
		domain.TranslationLanguage(r.Target) == "" || r.Model != domain.TranslationModel || len(r.Body) > 128<<10 || len(r.Subject) > 16<<10 {
		return domain.TranslationResult{}, false, domain.ErrTranslationStorage
	}
	return r, true, nil
}
func (s *TranslationStore) WriteCache(ctx context.Context, key string, result domain.TranslationResult) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !validTranslationKey(key) {
		return domain.ErrTranslationInput
	}
	return s.write(ctx, "translations/"+key+".json", translationCacheFile{domain.TranslationFormat, result})
}
func (s *TranslationStore) read(ctx context.Context, name string, maximum int, value interface{}) (bool, error) {
	if ctx.Err() != nil {
		return false, ctx.Err()
	}
	root, err := os.OpenRoot(s.dir)
	if err != nil {
		return false, domain.ErrTranslationStorage
	}
	defer root.Close()
	info, err := root.Lstat(name)
	if errors.Is(err, fs.ErrNotExist) {
		return false, nil
	}
	if err != nil || !info.Mode().IsRegular() || info.Size() > int64(maximum) {
		return false, domain.ErrTranslationStorage
	}
	file, err := root.Open(name)
	if err != nil {
		return false, domain.ErrTranslationStorage
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, int64(maximum)+1))
	if err != nil || len(data) > maximum {
		return false, domain.ErrTranslationStorage
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if decoder.Decode(value) != nil || decoder.Decode(new(json.RawMessage)) != io.EOF {
		return false, domain.ErrTranslationStorage
	}
	return true, ctx.Err()
}
func (s *TranslationStore) write(ctx context.Context, name string, value interface{}) (result error) {
	if ctx.Err() != nil {
		return ctx.Err()
	}
	data, err := json.Marshal(value)
	if err != nil || len(data) > 1<<20 {
		return domain.ErrTranslationStorage
	}
	root, err := os.OpenRoot(s.dir)
	if err != nil {
		return domain.ErrTranslationStorage
	}
	defer root.Close()
	cache := strings.HasPrefix(name, "translations/")
	if cache {
		if err := root.Mkdir("translations", 0o700); err != nil && !errors.Is(err, fs.ErrExist) {
			return domain.ErrTranslationStorage
		}
		info, err := root.Lstat("translations")
		if err != nil || !info.IsDir() || info.Mode()&fs.ModeSymlink != 0 {
			return domain.ErrTranslationStorage
		}
		if err := pruneTranslations(root, len(data)); err != nil {
			return err
		}
	}
	temp := ".translation-" + rand.Text() + ".tmp"
	if cache {
		temp = "translations/" + temp
	}
	file, err := root.OpenFile(temp, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return domain.ErrTranslationStorage
	}
	defer func() {
		if err := root.Remove(temp); err != nil && !errors.Is(err, fs.ErrNotExist) {
			result = domain.ErrTranslationStorage
		}
	}()
	_, writeErr := file.Write(data)
	syncErr, closeErr := file.Sync(), file.Close()
	if writeErr != nil || syncErr != nil || closeErr != nil {
		return domain.ErrTranslationStorage
	}
	if ctx.Err() != nil {
		return ctx.Err()
	}
	if root.Rename(temp, name) != nil {
		return domain.ErrTranslationStorage
	}
	return nil
}
func pruneTranslations(root *os.Root, incoming int) error {
	entries, err := fs.ReadDir(root.FS(), "translations")
	if err != nil {
		return domain.ErrTranslationStorage
	}
	type entry struct {
		name string
		info fs.FileInfo
	}
	files := []entry{}
	total := int64(incoming)
	for _, file := range entries {
		name := strings.TrimSuffix(file.Name(), ".json")
		if !strings.HasSuffix(file.Name(), ".json") || !validTranslationKey(name) {
			continue
		}
		info, err := file.Info()
		if err != nil {
			return domain.ErrTranslationStorage
		}
		if !info.Mode().IsRegular() {
			continue
		}
		files = append(files, entry{file.Name(), info})
		total += info.Size()
	}
	sort.Slice(files, func(i, j int) bool { return files[i].info.ModTime().Before(files[j].info.ModTime()) })
	for len(files) >= 128 || total > 16<<20 {
		if len(files) == 0 {
			return domain.ErrTranslationStorage
		}
		old := files[0]
		if root.Remove("translations/"+old.name) != nil {
			return domain.ErrTranslationStorage
		}
		total -= old.info.Size()
		files = files[1:]
	}
	return nil
}
