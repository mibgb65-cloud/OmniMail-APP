package domain

import (
	"context"
	"errors"
)

const TranslationModel = "Index-Translate-35B-A3B"
const TranslationFormat = "subject-body-v1"

var (
	ErrTranslationInput       = errors.New("TRANSLATION_INVALID_INPUT")
	ErrTranslationConsent     = errors.New("TRANSLATION_CONSENT_REQUIRED")
	ErrTranslationBusy        = errors.New("TRANSLATION_BUSY")
	ErrTranslationUnavailable = errors.New("TRANSLATION_UNAVAILABLE")
	ErrTranslationRate        = errors.New("TRANSLATION_RATE_LIMITED")
	ErrTranslationResponse    = errors.New("TRANSLATION_INVALID_RESPONSE")
	ErrTranslationTruncated   = errors.New("TRANSLATION_TRUNCATED")
	ErrTranslationStorage     = errors.New("TRANSLATION_STORAGE_FAILED")
	ErrTranslationNotReady    = errors.New("TRANSLATION_BODY_NOT_READY")
	ErrTranslationTooLarge    = errors.New("TRANSLATION_TOO_LARGE")
)

func TranslationLanguage(code string) string {
	return map[string]string{"zh": "简体中文", "en": "英语", "ja": "日语", "ko": "韩语", "de": "德语", "fr": "法语", "es": "西班牙语"}[code]
}

type TranslationPreferences struct {
	Target  string `json:"target"`
	Consent bool   `json:"consent"`
}
type TranslatedText struct {
	Subject string `json:"subject"`
	Body    string `json:"body"`
}
type TranslationResult struct {
	MailID     string `json:"mailId"`
	SourceHash string `json:"sourceHash"`
	Target     string `json:"target"`
	Model      string `json:"model"`
	Subject    string `json:"subject"`
	Body       string `json:"body"`
	Cached     bool   `json:"cached"`
	Warning    string `json:"warning,omitempty"`
}
type TranslationProvider interface {
	Translate(context.Context, TranslatedText, string) (TranslatedText, error)
}
type TranslationStore interface {
	Preferences(context.Context) (TranslationPreferences, error)
	SavePreferences(context.Context, TranslationPreferences) error
	ReadCache(context.Context, string) (TranslationResult, bool, error)
	WriteCache(context.Context, string, TranslationResult) error
}
type TranslationReader interface {
	ReadMail(context.Context, string) (MailDetail, error)
}
