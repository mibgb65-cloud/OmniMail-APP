package config

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"io"
	"os"

	"omnimail/desktop/internal/domain"
)

const customProvidersFile = "custom-providers.json"
const customProvidersMaxBytes = 64 << 10

type CustomProviders struct{ dataDir string }

func NewCustomProviders(dataDir string) *CustomProviders { return &CustomProviders{dataDir: dataDir} }

type providerFile struct {
	Version   int                     `json:"version"`
	Providers []domain.CustomProvider `json:"providers"`
}

func (s *CustomProviders) Load(ctx context.Context) ([]domain.CustomProvider, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	root, err := os.OpenRoot(s.dataDir)
	if err != nil {
		return nil, domain.ErrProviderStorage
	}
	defer root.Close()
	info, err := root.Lstat(customProvidersFile)
	if errors.Is(err, os.ErrNotExist) {
		return []domain.CustomProvider{}, nil
	}
	if err != nil || !info.Mode().IsRegular() || info.Size() > customProvidersMaxBytes {
		return nil, domain.ErrProviderStorage
	}
	file, err := root.Open(customProvidersFile)
	if err != nil {
		return nil, domain.ErrProviderStorage
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, customProvidersMaxBytes+1))
	if err != nil || len(data) > customProvidersMaxBytes {
		return nil, domain.ErrProviderStorage
	}
	var value providerFile
	decoder := json.NewDecoder(bytes.NewReader(data))
	// 旧文件若含凭据或未知字段，必须拒绝而不是把它当合法模板继续传播。
	decoder.DisallowUnknownFields()
	if decoder.Decode(&value) != nil || decoder.Decode(new(json.RawMessage)) != io.EOF ||
		value.Version != 1 || value.Providers == nil || domain.ValidateCustomProviders(value.Providers) != nil {
		return nil, domain.ErrProviderStorage
	}
	return value.Providers, ctx.Err()
}
func (s *CustomProviders) Save(ctx context.Context, values []domain.CustomProvider) (result error) {
	if err := domain.ValidateCustomProviders(values); err != nil {
		return err
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if values == nil {
		values = []domain.CustomProvider{}
	}
	data, err := json.Marshal(providerFile{Version: 1, Providers: values})
	if err != nil || len(data) > customProvidersMaxBytes {
		return domain.ErrProviderStorage
	}
	root, err := os.OpenRoot(s.dataDir)
	if err != nil {
		return domain.ErrProviderStorage
	}
	defer root.Close()
	name := ".providers-" + rand.Text() + ".tmp"
	file, err := root.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return domain.ErrProviderStorage
	}
	defer func() {
		if err := root.Remove(name); err != nil && !errors.Is(err, os.ErrNotExist) {
			result = domain.ErrProviderStorage
		}
	}()
	_, writeErr := file.Write(data)
	syncErr, closeErr := file.Sync(), file.Close()
	if writeErr != nil || syncErr != nil || closeErr != nil {
		return domain.ErrProviderStorage
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if root.Rename(name, customProvidersFile) != nil {
		return domain.ErrProviderStorage
	}
	return nil
}
