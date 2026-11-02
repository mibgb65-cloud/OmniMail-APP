package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
	"sync"
	"time"

	"omnimail/desktop/internal/domain"
)

type Translation struct {
	reader   domain.TranslationReader
	store    domain.TranslationStore
	provider domain.TranslationProvider
	ctx      context.Context
	cancel   context.CancelFunc
	mu       sync.Mutex
	wg       sync.WaitGroup
	closed   bool
	active   context.CancelFunc
	slot     chan struct{}
}

func NewTranslation(reader domain.TranslationReader, store domain.TranslationStore, provider domain.TranslationProvider) *Translation {
	ctx, cancel := context.WithCancel(context.Background())
	return &Translation{reader: reader, store: store, provider: provider, ctx: ctx, cancel: cancel, slot: make(chan struct{}, 1)}
}
func (s *Translation) Preferences(ctx context.Context) (domain.TranslationPreferences, error) {
	return s.store.Preferences(ctx)
}
func (s *Translation) SetPreferences(ctx context.Context, prefs domain.TranslationPreferences) error {
	if domain.TranslationLanguage(prefs.Target) == "" {
		return domain.ErrTranslationInput
	}
	if err := s.store.SavePreferences(ctx, prefs); err != nil {
		return domain.ErrTranslationStorage
	}
	s.mu.Lock()
	if s.active != nil {
		s.active()
	}
	s.mu.Unlock()
	return nil
}

// 授权、源文与缓存必须属于同一个有界任务，避免撤销/刷新后沿用旧快照；
// HTTP、文字提取和磁盘操作已各自隔离，此处只编排同一任务的生命周期。
func (s *Translation) Translate(ctx context.Context, id, target string) (domain.TranslationResult, error) {
	var empty domain.TranslationResult
	if !domain.ValidAccountID(id) || domain.TranslationLanguage(target) == "" {
		return empty, domain.ErrTranslationInput
	}
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return empty, context.Canceled
	}
	select {
	case s.slot <- struct{}{}:
	default:
		s.mu.Unlock()
		return empty, domain.ErrTranslationBusy
	}
	ctx, cancel := context.WithTimeout(ctx, 120*time.Second)
	stop := context.AfterFunc(s.ctx, cancel)
	s.active = cancel
	s.wg.Add(1)
	s.mu.Unlock()
	defer func() {
		stop()
		cancel()
		s.mu.Lock()
		s.active = nil
		s.mu.Unlock()
		<-s.slot
		s.wg.Done()
	}()
	prefs, err := s.store.Preferences(ctx)
	if err != nil {
		return empty, domain.ErrTranslationStorage
	}
	if !prefs.Consent {
		return empty, domain.ErrTranslationConsent
	}
	detail, err := s.reader.ReadMail(ctx, id)
	if err != nil || detail.ID != id {
		return empty, domain.ErrTranslationNotReady
	}
	source, err := translationText(detail)
	if err != nil {
		return empty, err
	}
	sourceHash, key, err := translationCacheKey(detail, source, target)
	if err != nil {
		return empty, err
	}
	cached, found, cacheErr := s.store.ReadCache(ctx, key)
	if cacheErr == nil && found && cached.MailID == id && cached.SourceHash == sourceHash && cached.Target == target {
		cached.Cached = true
		return cached, ctx.Err()
	}
	chunks := splitTranslationText(source.Body)
	if len(chunks) > 16 {
		return empty, domain.ErrTranslationTooLarge
	}
	result := domain.TranslationResult{MailID: id, SourceHash: sourceHash, Target: target, Model: domain.TranslationModel}
	var body strings.Builder
	for index, chunk := range chunks {
		part := domain.TranslatedText{Body: chunk}
		if index == 0 {
			part.Subject = source.Subject
		}
		translated, err := s.provider.Translate(ctx, part, target)
		if err != nil {
			return empty, err
		}
		if index == 0 {
			result.Subject = translated.Subject
		}
		if index > 0 {
			body.WriteString("\n\n")
		}
		body.WriteString(translated.Body)
		if body.Len() > 128<<10 {
			return empty, domain.ErrTranslationTooLarge
		}
	}
	result.Body = body.String()
	if ctx.Err() != nil {
		return empty, ctx.Err()
	}
	if err := s.store.WriteCache(ctx, key, result); err != nil {
		result.Warning = "CACHE_NOT_SAVED"
	} else if cacheErr != nil {
		result.Warning = "CACHE_REBUILT"
	}
	return result, nil
}

// Cached 只读本地，不授权或调用公网；用于重新打开邮件时恢复工具栏开关。
func (s *Translation) Cached(ctx context.Context, id string) (*domain.TranslationResult, error) {
	if !domain.ValidAccountID(id) {
		return nil, domain.ErrTranslationInput
	}
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return nil, context.Canceled
	}
	s.wg.Add(1)
	s.mu.Unlock()
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	stop := context.AfterFunc(s.ctx, cancel)
	defer func() { stop(); cancel(); s.wg.Done() }()
	prefs, err := s.store.Preferences(ctx)
	if err != nil {
		return nil, domain.ErrTranslationStorage
	}
	detail, err := s.reader.ReadMail(ctx, id)
	if err != nil || detail.ID != id {
		return nil, domain.ErrTranslationNotReady
	}
	source, err := translationText(detail)
	if err != nil {
		return nil, err
	}
	hash, key, err := translationCacheKey(detail, source, prefs.Target)
	if err != nil {
		return nil, err
	}
	value, found, err := s.store.ReadCache(ctx, key)
	if err != nil {
		return nil, domain.ErrTranslationStorage
	}
	if !found || value.MailID != id || value.SourceHash != hash || value.Target != prefs.Target {
		return nil, ctx.Err()
	}
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	value.Cached = true
	return &value, nil
}
func translationCacheKey(detail domain.MailDetail, source domain.TranslatedText, target string) (string, string, error) {
	encoded, err := json.Marshal(source)
	if err != nil {
		return "", "", domain.ErrTranslationInput
	}
	digest := sha256.Sum256(encoded)
	sourceHash := hex.EncodeToString(digest[:])
	key := sha256.Sum256([]byte(detail.AccountID + "\x00" + detail.ID + "\x00" + sourceHash + "\x00" + target + "\x00" + domain.TranslationModel + "\x00" + domain.TranslationFormat))
	return sourceHash, hex.EncodeToString(key[:]), nil
}
func (s *Translation) Close() {
	s.mu.Lock()
	s.closed = true
	s.cancel()
	s.mu.Unlock()
	s.wg.Wait()
}
