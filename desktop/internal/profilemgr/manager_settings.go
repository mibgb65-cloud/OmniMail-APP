package profilemgr

import (
	"omnimail/internal/config"
	"omnimail/internal/security"
)

func (m *Manager) readMaskedSettingsUnlocked() config.AppSettings {
	if m.active == nil {
		return config.DefaultAppSettings()
	}
	s := config.LoadProfileSettings(m.active.ProfileDir)
	if m.active.Vault != nil {
		keyName := "ai:provider:" + s.AiProvider + ":api_key"
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
	m.mu.Lock()
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
