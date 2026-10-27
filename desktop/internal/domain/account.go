package domain

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/mail"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

type Protocol string
type TLSMode string
type AuthKind string
type AccountStatus string

const (
	ProtocolIMAP Protocol = "imap"
	ProtocolSMTP Protocol = "smtp"
	TLSImplicit  TLSMode  = "implicit_tls"
	TLSStartTLS  TLSMode  = "starttls"
	AuthPassword AuthKind = "password"
	AuthOAuth2   AuthKind = "oauth2"

	AccountConfigured   AccountStatus = "configured"
	AccountReauth       AccountStatus = "reauth_required"
	AccountDisconnected AccountStatus = "disconnected"
)

var (
	ErrInvalidAccount  = errors.New("账号配置无效")
	ErrAccountNotFound = errors.New("账号不存在")
	ErrAccountConflict = errors.New("账号配置冲突")
	identifierPattern  = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)
	providerPattern    = regexp.MustCompile(`^[a-z][a-z0-9_]{0,63}$`)
	credentialPattern  = regexp.MustCompile(`^omnimail/account/[A-Za-z0-9_-]{1,64}(/(imap|smtp))?$`)
)

type Account struct {
	ID           string
	ProviderCode string
	Email        string
	DisplayName  string
	ColorIndex   int
	SortOrder    int
	Status       AccountStatus
	SyncEnabled  bool
	CreatedAt    int64
	UpdatedAt    int64
	Endpoints    []AccountEndpoint
}

type AccountEndpoint struct {
	ID            string
	Protocol      Protocol
	Host          string
	Port          int
	TLSMode       TLSMode
	Username      string
	AuthKind      AuthKind
	CredentialRef string
	CreatedAt     int64
	UpdatedAt     int64
}

type AccountRepository interface {
	CreateAccount(context.Context, Account) (Account, error)
	GetAccount(context.Context, string) (Account, error)
	ListAccounts(context.Context) ([]Account, error)
	UpdateAccount(context.Context, Account) (Account, error)
	DisconnectAccount(context.Context, string) ([]string, error)
	DeleteAccount(context.Context, string) ([]string, error)
}

// CredentialStore 是未来服务层的 OS 适配边界；领域与数据库中没有密码或令牌字段。
type CredentialStore interface {
	Set(context.Context, string, []byte) error
	Get(context.Context, string) ([]byte, error)
	Delete(context.Context, string) error
}

func ValidAccountID(id string) bool { return identifierPattern.MatchString(id) }

func (a Account) Validate() error {
	if !ValidAccountID(a.ID) || !providerPattern.MatchString(a.ProviderCode) {
		return invalidAccount("标识")
	}
	address, err := mail.ParseAddress(a.Email)
	if !validText(a.Email, 254, false) || err != nil || address.Address != a.Email {
		return invalidAccount("邮箱地址")
	}
	if !validText(a.DisplayName, 256, true) || a.ColorIndex < 0 || a.ColorIndex > 5 ||
		a.SortOrder < 0 || a.SortOrder > 1000000 {
		return invalidAccount("显示设置")
	}
	if a.Status != AccountConfigured && a.Status != AccountReauth && a.Status != AccountDisconnected {
		return invalidAccount("生命周期状态")
	}
	if a.Status == AccountDisconnected && a.SyncEnabled {
		return invalidAccount("断开账号的同步设置")
	}
	if a.CreatedAt <= 0 || a.UpdatedAt < a.CreatedAt || len(a.Endpoints) != 2 {
		return invalidAccount("时间或连接数量")
	}
	seen := map[Protocol]bool{}
	ids := map[string]bool{}
	for _, endpoint := range a.Endpoints {
		if seen[endpoint.Protocol] || ids[endpoint.ID] {
			return invalidAccount("重复连接")
		}
		if err := endpoint.validate(a.Status); err != nil {
			return err
		}
		seen[endpoint.Protocol], ids[endpoint.ID] = true, true
	}
	return nil
}

func (e AccountEndpoint) validate(status AccountStatus) error {
	if !ValidAccountID(e.ID) || (e.Protocol != ProtocolIMAP && e.Protocol != ProtocolSMTP) ||
		!validHost(e.Host) || e.Port < 1 || e.Port > 65535 {
		return invalidAccount("连接地址")
	}
	if (e.TLSMode != TLSImplicit && e.TLSMode != TLSStartTLS) ||
		(e.AuthKind != AuthPassword && e.AuthKind != AuthOAuth2) || !validText(e.Username, 320, false) {
		return invalidAccount("连接认证设置")
	}
	if e.CreatedAt <= 0 || e.UpdatedAt < e.CreatedAt {
		return invalidAccount("连接时间")
	}
	if status == AccountDisconnected {
		if e.CredentialRef != "" {
			return invalidAccount("断开账号的凭据引用")
		}
	} else if !credentialPattern.MatchString(e.CredentialRef) {
		return invalidAccount("凭据引用")
	}
	return nil
}

func validText(value string, maximum int, allowEmpty bool) bool {
	return (allowEmpty || value != "") && len(value) <= maximum && utf8.ValidString(value) &&
		!strings.ContainsFunc(value, unicode.IsControl)
}

func validHost(host string) bool {
	if !validText(host, 253, false) {
		return false
	}
	if net.ParseIP(host) != nil {
		return true
	}
	for _, label := range strings.Split(strings.TrimSuffix(host, "."), ".") {
		if len(label) == 0 || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for _, char := range label {
			if !(char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z' ||
				char >= '0' && char <= '9' || char == '-') {
				return false
			}
		}
	}
	return true
}

func invalidAccount(field string) error {
	return fmt.Errorf("%s: %w", field, ErrInvalidAccount)
}
