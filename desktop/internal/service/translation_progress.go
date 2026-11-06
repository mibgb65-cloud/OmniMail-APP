package service

import (
	"context"
	"time"

	"omnimail/desktop/internal/domain"
)

type TranslationProgress struct {
	Stage        string `json:"stage"`
	Current      int    `json:"current"`
	Total        int    `json:"total"`
	RetrySeconds int    `json:"retrySeconds"`
}

func (s *Translation) Progress(ctx context.Context, id string) (TranslationProgress, error) {
	if !domain.ValidAccountID(id) {
		return TranslationProgress{}, domain.ErrTranslationInput
	}
	if ctx.Err() != nil {
		return TranslationProgress{}, ctx.Err()
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	value := TranslationProgress{Stage: "idle"}
	if s.activeID == id {
		value = s.progress
	}
	value.RetrySeconds = max(0, int(time.Until(s.cooldown).Seconds()+0.99))
	return value, nil
}
