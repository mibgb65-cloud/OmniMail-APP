package profilemgr

import (
	"omnimail/internal/apperr"
	"omnimail/internal/config"
	"omnimail/internal/security"
)

func (m *Manager) readMaskedSettingsUnlocked() config.AppSettings {
	if m.active == nil {
		return config.DefaultAppSettings()
	}
	s := config.LoadProfileSettings(m.active.ProfileDir)
	prov, base, err := config.ResolveAiEndpoint(s.AiProvider, s.AiBaseURL)
	if err == nil {
		s.AiProvider, s.AiBaseURL = prov, base
	}
	if err == nil && m.active.Vault != nil {
		keyName := config.AiVaultKey(prov, base)
		if rawKey, ok := m.active.Vault.Get(keyName); ok && rawKey != "" {
			s.AiApiKeyMasked = security.MaskSecret(rawKey)
		}
	}
	return s
}

func (m *Manager) GetAppSettings() (config.AppSettings, error) {
	if _, err := m.ActiveSession(); err != nil {
		return config.AppSettings{}, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.readMaskedSettingsUnlocked(), nil
}

func (m *Manager) UpdateAppSettings(patch config.AppSettingsPatch) (config.AppSettings, error) {
	sess, err := m.ActiveSession()
	if err != nil {
		return config.AppSettings{}, err
	}
	return m.UpdateSessionSettings(sess, patch)
}

func (m *Manager) UpdateSessionSettings(sess *Session, patch config.AppSettingsPatch) (config.AppSettings, error) {
	if err := config.ValidateTranslationSettingsPatch(patch); err != nil {
		return config.AppSettings{}, err
	}
	m.mu.Lock()
	if m.active != sess || sess == nil {
		m.mu.Unlock()
		return config.AppSettings{}, apperr.New(apperr.CodeInvalidInput, "活动空间已切换，请重新打开设置")
	}
	cur := config.LoadProfileSettings(sess.ProfileDir)
	next := config.ApplySettingsPatch(cur, patch)
	if err := config.SaveProfileSettings(sess.ProfileDir, next); err != nil {
		m.mu.Unlock()
		return config.AppSettings{}, err
	}
	masked := m.readMaskedSettingsUnlocked()
	hooks := append([]SessionHook(nil), m.hooks...)
	m.mu.Unlock()
	for _, h := range hooks {
		h.OnSettingsChanged(sess, masked)
	}
	return masked, nil
}

func migrateAiEndpointKey(vault *security.Vault, settings config.AppSettings) {
	prov, base, err := config.ResolveAiEndpoint(settings.AiProvider, settings.AiBaseURL)
	if err != nil || config.AiPresetBaseURL(prov) != "" {
		return
	}
	legacy := config.LegacyAiVaultKey(prov)
	if value, ok := vault.Get(legacy); ok && value != "" {
		scoped := config.AiVaultKey(prov, base)
		// 旧密钥只可绑定到升级时当前保存的端点，不能跟随之后的地址变更。
		if _, exists := vault.Get(scoped); exists || vault.Set(scoped, value) == nil {
			_ = vault.Delete(legacy)
		}
	}
}
