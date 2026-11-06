package domain

import (
	"context"
	"errors"
	"regexp"
	"strings"
)

const MaxCustomProviders = 32

var (
	ErrProviderTemplate = errors.New("INVALID_INPUT")
	ErrProviderName     = errors.New("PROVIDER_NAME_EXISTS")
	ErrProviderLimit    = errors.New("PROVIDER_LIMIT")
	ErrProviderStorage  = errors.New("PROVIDER_STORAGE_FAILED")
	customProviderCode  = regexp.MustCompile(`^saved_[a-f0-9]{32}$`)
)

// ProviderServer 不含认证字段，避免将账号凭据意外复制到可复用的服务商模板。
type ProviderServer struct {
	Host    string  `json:"host"`
	Port    int     `json:"port"`
	TLSMode TLSMode `json:"tlsMode"`
}

func (s ProviderServer) Valid() bool {
	return validHost(s.Host) && s.Port >= 1 && s.Port <= 65535 &&
		(s.TLSMode == TLSImplicit || s.TLSMode == TLSStartTLS)
}

type CustomProvider struct {
	Code string         `json:"code"`
	Name string         `json:"name"`
	IMAP ProviderServer `json:"imap"`
	SMTP ProviderServer `json:"smtp"`
}

func (p CustomProvider) Valid() bool {
	return customProviderCode.MatchString(p.Code) && validText(p.Name, 128, false) &&
		p.Name == strings.TrimSpace(p.Name) && p.IMAP.Valid() && p.SMTP.Valid()
}
func (p CustomProvider) Preset() ProviderPreset {
	return ProviderPreset{Code: p.Code, Name: p.Name, AuthKinds: []AuthKind{AuthPassword},
		Endpoints: []EndpointPreset{
			{Protocol: ProtocolIMAP, Host: p.IMAP.Host, Port: p.IMAP.Port, TLSMode: p.IMAP.TLSMode},
			{Protocol: ProtocolSMTP, Host: p.SMTP.Host, Port: p.SMTP.Port, TLSMode: p.SMTP.TLSMode},
		}}
}
func ValidateCustomProviders(values []CustomProvider) error {
	if len(values) > MaxCustomProviders {
		return ErrProviderLimit
	}
	for index, value := range values {
		if !value.Valid() {
			return ErrProviderTemplate
		}
		for _, previous := range values[:index] {
			if previous.Code == value.Code || strings.EqualFold(previous.Name, value.Name) {
				return ErrProviderName
			}
		}
	}
	return nil
}

type CustomProviderStore interface {
	Load(context.Context) ([]CustomProvider, error)
	Save(context.Context, []CustomProvider) error
}
