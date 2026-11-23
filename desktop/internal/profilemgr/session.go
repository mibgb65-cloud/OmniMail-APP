package profilemgr

import (
	"context"
	"database/sql"

	"omnimail/internal/config"
	"omnimail/internal/security"
	"omnimail/internal/storage"
)

type BootstrapState struct {
	DataDir         string
	Initialized     bool
	ActiveProfileID string
	LaunchBehavior  string
}

type BootstrapAdapter interface {
	ReadBootstrapState() BootstrapState
	WriteBootstrapState(next BootstrapState) error
}

type Session struct {
	Meta       config.ProfileMeta
	ProfileDir string
	DB         *sql.DB
	Vault      *security.Vault
	Blobs      *storage.BlobStore
	Ctx        context.Context
	Cancel     context.CancelFunc
}

type SessionHook interface {
	OnSessionOpened(sess *Session)
	OnSessionClosing(sess *Session)
	OnSettingsChanged(sess *Session, next config.AppSettings)
}

type ProfileSummary struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Badge           string `json:"badge"`
	Color           string `json:"color"`
	CustomDir       string `json:"customDir,omitempty"`
	ProfileDir      string `json:"profileDir"`
	ThemePreference string `json:"themePreference"`
	PinEnabled      bool   `json:"pinEnabled"`
	Locked          bool   `json:"locked"`
	AccountCount    int    `json:"accountCount"`
	CreatedAt       string `json:"createdAt"`
	LastActiveAt    string `json:"lastActiveAt"`
}

type ProfileListResponse struct {
	ActiveProfileID string           `json:"activeProfileId"`
	LaunchBehavior  string           `json:"launchBehavior"`
	RequiresUnlock  bool             `json:"requiresUnlock"`
	Profiles        []ProfileSummary `json:"profiles"`
}

type CreateProfileRequest struct {
	Name            string `json:"name"`
	Badge           string `json:"badge"`
	Color           string `json:"color"`
	CustomDir       string `json:"customDir,omitempty"`
	ThemePreference string `json:"themePreference"`
	PIN             string `json:"pin,omitempty"`
}

type UpdateProfileRequest struct {
	ID              string  `json:"id"`
	Name            *string `json:"name,omitempty"`
	Badge           *string `json:"badge,omitempty"`
	Color           *string `json:"color,omitempty"`
	ThemePreference *string `json:"themePreference,omitempty"`
	CurrentPIN      string  `json:"currentPin,omitempty"`
	NewPIN          *string `json:"newPin,omitempty"`
	DisablePIN      bool    `json:"disablePin,omitempty"`
	LaunchBehavior  *string `json:"launchBehavior,omitempty"`
}

type ProfileSwitchResult struct {
	Profile  ProfileSummary     `json:"profile"`
	Settings config.AppSettings `json:"settings"`
}
