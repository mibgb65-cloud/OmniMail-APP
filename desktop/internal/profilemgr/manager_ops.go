package profilemgr

import (
	"os"
	"path/filepath"
	"strings"

	"omnimail/internal/apperr"
	"omnimail/internal/config"
	"omnimail/internal/security"
	"omnimail/internal/storage"
)

func (m *Manager) UpdateProfile(req UpdateProfileRequest) (ProfileSummary, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	bs := m.boot.ReadBootstrapState()
	reg, err := config.LoadRegistry(bs.DataDir)
	if err != nil {
		return ProfileSummary{}, err
	}
	if req.LaunchBehavior != nil && (*req.LaunchBehavior == "last-profile" || *req.LaunchBehavior == "ask-on-launch") {
		bs.LaunchBehavior = *req.LaunchBehavior
		_ = m.boot.WriteBootstrapState(bs)
	}
	idx := -1
	for i, p := range reg.Profiles {
		if p.ID == req.ID {
			idx = i
			break
		}
	}
	if idx < 0 {
		return ProfileSummary{}, apperr.New(apperr.CodeNotFound, "未找到指定的本地工作空间")
	}
	p := reg.Profiles[idx]
	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		p.Name = strings.TrimSpace(*req.Name)
	}
	if req.Badge != nil && strings.TrimSpace(*req.Badge) != "" {
		p.Badge = string([]rune(strings.TrimSpace(*req.Badge))[:1])
	}
	if req.Color != nil && strings.TrimSpace(*req.Color) != "" {
		p.Color = strings.TrimSpace(*req.Color)
	}
	if req.ThemePreference != nil && (*req.ThemePreference == "light" || *req.ThemePreference == "dark" || *req.ThemePreference == "system") {
		p.ThemePreference = *req.ThemePreference
	}
	if req.DisablePIN && p.PinEnabled {
		if err := m.pinGuard.CheckAndVerify(p.ID, req.CurrentPIN, p.PinSalt, p.PinHash); err != nil {
			return ProfileSummary{}, err
		}
		p.PinEnabled, p.PinSalt, p.PinHash = false, "", ""
		delete(m.unlocked, p.ID)
	} else if req.NewPIN != nil && strings.TrimSpace(*req.NewPIN) != "" {
		if p.PinEnabled {
			if err := m.pinGuard.CheckAndVerify(p.ID, req.CurrentPIN, p.PinSalt, p.PinHash); err != nil {
				return ProfileSummary{}, err
			}
		}
		salt, hash, err := security.HashPIN(*req.NewPIN)
		if err != nil {
			return ProfileSummary{}, err
		}
		p.PinEnabled, p.PinSalt, p.PinHash = true, salt, hash
		m.unlocked[p.ID] = true
	}
	reg.Profiles[idx] = p
	if err := config.SaveRegistry(bs.DataDir, reg); err != nil {
		return ProfileSummary{}, err
	}
	if m.active != nil && m.active.Meta.ID == p.ID {
		m.active.Meta = p
	}
	return m.buildSummaryUnlocked(bs.DataDir, p), nil
}

func (m *Manager) LockProfile(profileID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	bs := m.boot.ReadBootstrapState()
	reg, err := config.LoadRegistry(bs.DataDir)
	if err != nil {
		return err
	}
	for _, p := range reg.Profiles {
		if p.ID == profileID {
			if !p.PinEnabled {
				return apperr.New(apperr.CodeInvalidInput, "该工作空间尚未开启 PIN 锁")
			}
			delete(m.unlocked, profileID)
			if m.active != nil && m.active.Meta.ID == profileID {
				m.closeActiveUnlocked()
			}
			return nil
		}
	}
	return apperr.New(apperr.CodeNotFound, "未找到指定的本地工作空间")
}

func (m *Manager) DeleteProfile(profileID string, deleteLocalFiles bool, pin string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	bs := m.boot.ReadBootstrapState()
	reg, err := config.LoadRegistry(bs.DataDir)
	if err != nil {
		return err
	}
	if len(reg.Profiles) <= 1 {
		return apperr.New(apperr.CodeInvalidInput, "至少需要保留一个本地工作空间")
	}
	idx := -1
	for i, p := range reg.Profiles {
		if p.ID == profileID {
			idx = i
			break
		}
	}
	if idx < 0 {
		return apperr.New(apperr.CodeNotFound, "未找到要删除的工作空间")
	}
	target := reg.Profiles[idx]
	if target.PinEnabled {
		if err := m.pinGuard.CheckAndVerify(target.ID, pin, target.PinSalt, target.PinHash); err != nil {
			return err
		}
	}
	if m.active != nil && m.active.Meta.ID == profileID {
		m.closeActiveUnlocked()
	}
	delete(m.unlocked, profileID)
	profDir := config.ResolveProfileDir(bs.DataDir, target)
	reg.Profiles = append(reg.Profiles[:idx], reg.Profiles[idx+1:]...)
	if err := config.SaveRegistry(bs.DataDir, reg); err != nil {
		return err
	}
	if deleteLocalFiles && filepath.IsAbs(profDir) {
		_ = os.RemoveAll(profDir)
	}
	if bs.ActiveProfileID == profileID {
		next := reg.Profiles[0]
		bs.ActiveProfileID = next.ID
		_ = m.boot.WriteBootstrapState(bs)
		if !next.PinEnabled || m.unlocked[next.ID] {
			_ = m.openSessionUnlocked(bs.DataDir, next)
		}
	}
	return nil
}

func (m *Manager) ExportBackup(profileID string, opts storage.ExportBackupOptions) (string, error) {
	sess, err := m.ActiveSession()
	if err != nil {
		return "", err
	}
	if profileID != "" && sess.Meta.ID != profileID {
		return "", apperr.New(apperr.CodeInvalidInput, "请先切换到目标空间并解锁后再导出备份")
	}
	return storage.ExportProfileZip(sess.DB, sess.Vault, sess.Meta.ID, sess.ProfileDir, opts)
}
