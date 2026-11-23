package profilemgr

import (
	"fmt"
	"strings"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/config"
	"omnimail/internal/events"
	"omnimail/internal/security"
	"omnimail/internal/storage"
)

func (m *Manager) ListProfiles() (ProfileListResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	bs := m.boot.ReadBootstrapState()
	reg, err := config.LoadRegistry(bs.DataDir)
	if err != nil {
		return ProfileListResponse{}, err
	}
	activeID := bs.ActiveProfileID
	if activeID == "" && len(reg.Profiles) > 0 {
		activeID = reg.Profiles[0].ID
	}
	launch := bs.LaunchBehavior
	if launch == "" {
		launch = "last-profile"
	}
	out := ProfileListResponse{
		ActiveProfileID: activeID,
		LaunchBehavior:  launch,
		Profiles:        make([]ProfileSummary, 0, len(reg.Profiles)),
	}
	for _, p := range reg.Profiles {
		sum := m.buildSummaryUnlocked(bs.DataDir, p)
		if p.ID == activeID && sum.Locked {
			out.RequiresUnlock = true
		}
		out.Profiles = append(out.Profiles, sum)
	}
	return out, nil
}

func (m *Manager) CreateProfile(req CreateProfileRequest) (ProfileSummary, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" || len([]rune(name)) > 40 {
		return ProfileSummary{}, apperr.New(apperr.CodeInvalidInput, "请输入 1~40 字符的工作空间名称")
	}
	badge := strings.TrimSpace(req.Badge)
	if badge == "" {
		badge = string([]rune(name)[:1])
	}
	color := strings.TrimSpace(req.Color)
	if color == "" {
		color = "#1E293B"
	}
	theme := strings.TrimSpace(req.ThemePreference)
	if theme != "light" && theme != "dark" && theme != "system" {
		theme = "system"
	}
	var salt, hash string
	pinEnabled := strings.TrimSpace(req.PIN) != ""
	if pinEnabled {
		var err error
		salt, hash, err = security.HashPIN(req.PIN)
		if err != nil {
			return ProfileSummary{}, err
		}
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	bs := m.boot.ReadBootstrapState()
	reg, err := config.LoadRegistry(bs.DataDir)
	if err != nil {
		return ProfileSummary{}, err
	}
	id := fmt.Sprintf("prof-%d", time.Now().UnixMilli()%1_000_000_000)
	now := nowISO()
	meta := config.ProfileMeta{
		ID: id, Name: name, Badge: string([]rune(badge)[:1]), Color: color,
		CustomDir: strings.TrimSpace(req.CustomDir), ThemePreference: theme,
		PinEnabled: pinEnabled, PinSalt: salt, PinHash: hash, CreatedAt: now, LastActiveAt: now,
	}
	profDir := config.ResolveProfileDir(bs.DataDir, meta)
	if err := config.EnsureProfileDirectories(profDir); err != nil {
		return ProfileSummary{}, err
	}
	db, err := storage.OpenProfileDB(profDir)
	if err != nil {
		return ProfileSummary{}, err
	}
	_ = storage.CheckpointAndClose(db)
	def := config.DefaultAppSettings()
	def.ThemePreference = theme
	_ = config.SaveProfileSettings(profDir, def)
	reg.Profiles = append(reg.Profiles, meta)
	if err := config.SaveRegistry(bs.DataDir, reg); err != nil {
		return ProfileSummary{}, err
	}
	if pinEnabled {
		m.unlocked[id] = true
	}
	return m.buildSummaryUnlocked(bs.DataDir, meta), nil
}

func (m *Manager) SwitchProfile(profileID, pin string) (ProfileSwitchResult, error) {
	m.mu.Lock()
	bs := m.boot.ReadBootstrapState()
	reg, err := config.LoadRegistry(bs.DataDir)
	if err != nil {
		m.mu.Unlock()
		return ProfileSwitchResult{}, err
	}
	idx := -1
	for i, p := range reg.Profiles {
		if p.ID == profileID {
			idx = i
			break
		}
	}
	if idx < 0 {
		m.mu.Unlock()
		return ProfileSwitchResult{}, apperr.New(apperr.CodeNotFound, "未找到指定的本地工作空间")
	}
	target := reg.Profiles[idx]
	if target.PinEnabled && !m.unlocked[target.ID] {
		if strings.TrimSpace(pin) == "" {
			m.mu.Unlock()
			return ProfileSwitchResult{}, apperr.New(apperr.CodePinRequired, "该空间已设 PIN 锁，请输入 PIN 解锁")
		}
		if err := m.pinGuard.CheckAndVerify(target.ID, pin, target.PinSalt, target.PinHash); err != nil {
			m.mu.Unlock()
			return ProfileSwitchResult{}, err
		}
		m.unlocked[target.ID] = true
	}
	target.LastActiveAt = nowISO()
	reg.Profiles[idx] = target
	_ = config.SaveRegistry(bs.DataDir, reg)
	if err := m.openSessionUnlocked(bs.DataDir, target); err != nil {
		m.mu.Unlock()
		return ProfileSwitchResult{}, err
	}
	bs.ActiveProfileID = target.ID
	if bs.LaunchBehavior == "" {
		bs.LaunchBehavior = "last-profile"
	}
	_ = m.boot.WriteBootstrapState(bs)
	settings := m.readMaskedSettingsUnlocked()
	sum := m.buildSummaryUnlocked(bs.DataDir, target)
	m.mu.Unlock()

	if m.bus != nil {
		m.bus.Emit(events.ProfileSwitched, events.ProfileSwitchedPayload{
			ProfileID: target.ID, ProfileName: target.Name, ThemePreference: settings.ThemePreference,
		})
	}
	return ProfileSwitchResult{Profile: sum, Settings: settings}, nil
}
