package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"time"

	"omnimail/desktop/internal/domain"
)

func (s *AI) Run(parent context.Context, request domain.AIRequest) (domain.AIResult, error) {
	var empty domain.AIResult
	if request.Validate() != nil {
		return empty, domain.ErrAIInput
	}
	ctx, config, done, err := s.begin(parent, request.MailID)
	if err != nil {
		return empty, err
	}
	defer done()
	if !config.Config.Consent {
		return empty, domain.ErrAIConsent
	}
	source, accountID, err := s.source(ctx, request.MailID)
	if err != nil {
		return empty, err
	}
	hash, key, err := aiCacheKey(source, accountID, request, config.Config)
	if err != nil {
		return empty, err
	}
	if !request.Regenerate {
		cached, found, err := s.store.ReadAICache(ctx, key)
		if err != nil {
			return empty, domain.ErrAIStorage
		}
		if found {
			if !validAIResult(cached, source, accountID, request, config.Config, hash) {
				return empty, domain.ErrAIStorage
			}
			cached.Cached = true
			return cached, ctx.Err()
		}
	}
	output, err := s.generate(ctx, config, source, request)
	if err != nil {
		return empty, err
	}
	if output.Validate(source, request.Action) != nil {
		return empty, domain.ErrAIResponse
	}
	result := domain.AIResult{AIOutput: output, MailID: request.MailID, AccountID: accountID, SourceHash: hash,
		Revision: config.Config.Revision, Model: config.Config.Model, Language: config.Config.Language, Action: request.Action}
	// 保存和清理/配置变更互斥，避免清理完成后旧请求重新写回缓存。
	s.mu.Lock()
	defer s.mu.Unlock()
	if ctx.Err() != nil {
		return empty, ctx.Err()
	}
	s.stage = "savingResult"
	if s.store.WriteAICache(ctx, key, result) != nil {
		result.Warning = "CACHE_NOT_SAVED"
	}
	return result, nil
}

func aiCacheKey(source domain.TranslatedText, accountID string, request domain.AIRequest, config domain.AIConfig) (string, string, error) {
	encoded, err := json.Marshal(source)
	if err != nil {
		return "", "", domain.ErrAIInput
	}
	digest := sha256.Sum256(encoded)
	hash := hex.EncodeToString(digest[:])
	request.Regenerate = false
	input, err := json.Marshal(request)
	if err != nil {
		return "", "", domain.ErrAIInput
	}
	key := sha256.Sum256([]byte(accountID + "\x00" + string(input) + "\x00" + hash + "\x00" + config.Revision + "\x00" + domain.AIFormat))
	return hash, hex.EncodeToString(key[:]), nil
}
func validAIResult(r domain.AIResult, source domain.TranslatedText, accountID string, request domain.AIRequest, config domain.AIConfig, hash string) bool {
	return r.MailID == request.MailID && r.AccountID == accountID && r.SourceHash == hash && r.Revision == config.Revision &&
		r.Model == config.Model && r.Language == config.Language && r.Action == request.Action && r.AIOutput.Validate(source, request.Action) == nil
}

func (s *AI) Cached(parent context.Context, id string) (*domain.AIResult, error) {
	if !domain.ValidAccountID(id) {
		return nil, domain.ErrAIInput
	}
	ctx, cancel := context.WithTimeout(parent, 10*time.Second)
	defer cancel()
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return nil, context.Canceled
	}
	config, err := s.store.ReadAIConfig(ctx)
	if err != nil || config.Config.Endpoint == "" {
		return nil, err
	}
	source, accountID, err := s.source(ctx, id)
	if err != nil {
		return nil, err
	}
	request := domain.AIRequest{MailID: id, Action: "analysis"}
	hash, key, err := aiCacheKey(source, accountID, request, config.Config)
	if err != nil {
		return nil, err
	}
	result, found, err := s.store.ReadAICache(ctx, key)
	if err != nil {
		return nil, domain.ErrAIStorage
	}
	if !found {
		return nil, ctx.Err()
	}
	if !validAIResult(result, source, accountID, request, config.Config, hash) {
		return nil, domain.ErrAIStorage
	}
	result.Cached = true
	return &result, ctx.Err()
}

func (s *AI) ClearCache(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return context.Canceled
	}
	if s.active != nil {
		s.active()
	}
	return s.store.ClearAICache(ctx)
}

func (s *AI) source(ctx context.Context, id string) (domain.TranslatedText, string, error) {
	detail, err := s.reader.ReadMail(ctx, id)
	if ctx.Err() != nil {
		return domain.TranslatedText{}, "", ctx.Err()
	}
	if err != nil || detail.ID != id || !domain.ValidAccountID(detail.AccountID) {
		return domain.TranslatedText{}, "", domain.ErrAINotReady
	}
	source, err := translationText(detail)
	if errors.Is(err, domain.ErrTranslationTooLarge) {
		return source, "", domain.ErrAITooLarge
	}
	if err != nil {
		return source, "", domain.ErrAINotReady
	}
	return source, detail.AccountID, nil
}
