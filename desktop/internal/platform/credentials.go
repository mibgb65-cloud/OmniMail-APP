package platform

import (
	"context"
	"errors"
	"regexp"

	"omnimail/desktop/internal/domain"

	"github.com/zalando/go-keyring"
)

var (
	ErrCredentialMissing     = domain.ErrCredentialMissing
	ErrCredentialUnavailable = domain.ErrCredentialUnavailable
	ErrCredentialInvalid     = domain.ErrCredentialInvalid
	credentialReference      = regexp.MustCompile(`^omnimail/account/[A-Za-z0-9_-]{1,64}(/(imap|smtp))?$`)
)

type keyringBackend struct {
	set    func(string, string, string) error
	get    func(string, string) (string, error)
	delete func(string, string) error
}

type Credentials struct{ backend keyringBackend }

var _ domain.CredentialStore = (*Credentials)(nil)

func NewCredentials() *Credentials {
	return &Credentials{keyringBackend{keyring.Set, keyring.Get, keyring.Delete}}
}

func validReference(reference string) bool {
	return len(reference) <= 128 && credentialReference.MatchString(reference)
}

func (s *Credentials) Set(ctx context.Context, reference string, secret []byte) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	// 限长同时覆盖 Windows blob 和 macOS security stdin 命令上限；不向进程参数传秘密。
	if !validReference(reference) || len(secret) == 0 || len(secret) > 2048 {
		return ErrCredentialInvalid
	}
	if err := s.backend.set("OmniMail", reference, string(secret)); err != nil {
		return ErrCredentialUnavailable
	}
	return nil
}

func (s *Credentials) Get(ctx context.Context, reference string) ([]byte, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if !validReference(reference) {
		return nil, ErrCredentialInvalid
	}
	secret, err := s.backend.get("OmniMail", reference)
	if errors.Is(err, keyring.ErrNotFound) {
		return nil, ErrCredentialMissing
	}
	if err != nil {
		return nil, ErrCredentialUnavailable
	}
	if len(secret) == 0 || len(secret) > 2048 {
		return nil, ErrCredentialInvalid
	}
	return []byte(secret), nil
}

func (s *Credentials) Delete(ctx context.Context, reference string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if !validReference(reference) {
		return ErrCredentialInvalid
	}
	err := s.backend.delete("OmniMail", reference)
	if err != nil && !errors.Is(err, keyring.ErrNotFound) {
		return ErrCredentialUnavailable
	}
	return nil
}
