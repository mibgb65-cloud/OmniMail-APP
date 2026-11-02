package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"strings"
	"sync"

	"omnimail/desktop/internal/domain"
)

type CustomProviderInput struct {
	Name string                `json:"name"`
	IMAP domain.ProviderServer `json:"imap"`
	SMTP domain.ProviderServer `json:"smtp"`
}
type CustomProviders struct {
	mu    sync.Mutex
	store domain.CustomProviderStore
}

func NewCustomProviders(store domain.CustomProviderStore) *CustomProviders {
	return &CustomProviders{store: store}
}
func (s *CustomProviders) List(ctx context.Context) ([]domain.ProviderPreset, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	values, err := s.store.Load(ctx)
	if err != nil {
		return nil, domain.ErrProviderStorage
	}
	result := make([]domain.ProviderPreset, 0, len(values))
	for _, value := range values {
		result = append(result, value.Preset())
	}
	return result, nil
}
func (s *CustomProviders) Create(ctx context.Context, input CustomProviderInput) (domain.ProviderPreset, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return domain.ProviderPreset{}, err
	}
	var id [16]byte
	if _, err := rand.Read(id[:]); err != nil {
		return domain.ProviderPreset{}, domain.ErrProviderStorage
	}
	value := domain.CustomProvider{Code: "saved_" + hex.EncodeToString(id[:]), Name: strings.TrimSpace(input.Name), IMAP: input.IMAP, SMTP: input.SMTP}
	value.IMAP.Host = strings.ToLower(strings.TrimSpace(value.IMAP.Host))
	value.SMTP.Host = strings.ToLower(strings.TrimSpace(value.SMTP.Host))
	if !value.Valid() {
		return domain.ProviderPreset{}, domain.ErrProviderTemplate
	}
	for _, builtin := range domain.ProviderPresets() {
		if strings.EqualFold(builtin.Name, value.Name) {
			return domain.ProviderPreset{}, domain.ErrProviderName
		}
	}
	values, err := s.store.Load(ctx)
	if err != nil {
		return domain.ProviderPreset{}, domain.ErrProviderStorage
	}
	if len(values) >= domain.MaxCustomProviders {
		return domain.ProviderPreset{}, domain.ErrProviderLimit
	}
	values = append(values, value)
	if err := domain.ValidateCustomProviders(values); err != nil {
		return domain.ProviderPreset{}, err
	}
	if err := s.store.Save(ctx, values); err != nil {
		return domain.ProviderPreset{}, domain.ErrProviderStorage
	}
	return value.Preset(), nil
}
