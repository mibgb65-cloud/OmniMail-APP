package main

import (
	"errors"
	"os"
	"os/exec"
)

// CheckConnection 只检查桌面桥接，不访问网络或邮箱。
func (s *DesktopService) CheckConnection() string {
	return "已成功连接 OmniMail 桌面后端。"
}

// SaveThemePreference 在可信边界校验并持久化主题偏好，供下次冷启动设置原生窗口首帧背景色。
func (s *DesktopService) SaveThemePreference(theme string) bool {
	if !isValidThemePref(theme) {
		return false
	}
	store := s.ensureStore()
	prefs := store.readPreferences()
	prefs.ThemePreference = theme
	prefs.ResolvedTheme = resolveEffectiveTheme(theme)
	_, err := store.savePreferences(prefs)
	return err == nil
}

// GetBootstrapState 获取当前引导配置、桌面偏好、磁盘状态与一次性启动意图。
func (s *DesktopService) GetBootstrapState() BootstrapStateDTO {
	store := s.ensureStore()
	s.mu.Lock()
	intent := s.pendingIntent
	s.pendingIntent = LaunchIntent{}
	app := s.app
	s.mu.Unlock()

	prefs := store.readPreferences()
	if app != nil && app.Autostart != nil {
		if enabled, err := app.Autostart.IsEnabled(); err == nil && enabled != prefs.LaunchAtStartup {
			prefs.LaunchAtStartup = enabled
			_, _ = store.savePreferences(prefs)
		}
	}
	return BootstrapStateDTO{
		Bootstrap:    store.readBootstrap(),
		Preferences:  prefs,
		Storage:      store.getStorageInfo(),
		LaunchIntent: intent,
	}
}

// UpdateDesktopPreferences 校验并保存桌面端通用偏好（保留自动更新与渠道偏好不丢失）。
func (s *DesktopService) UpdateDesktopPreferences(in DesktopPreferences) (DesktopPreferences, error) {
	store := s.ensureStore()
	merged := mergeGeneralPreferences(store.readPreferences(), in)
	saved, err := store.savePreferences(merged)
	if err != nil {
		return DesktopPreferences{}, err
	}
	app, _ := s.runtimeHandles()
	syncSystemAutostart(app, saved.LaunchAtStartup)
	return saved, nil
}

// CompleteInitialSetup 完成首次启动引导的数据目录确认与桌面偏好保存。
func (s *DesktopService) CompleteInitialSetup(input InitialSetupInput) (BootstrapStateDTO, error) {
	store := s.ensureStore()
	boot, prefs, err := store.commitInitialSetup(input.DataDir, input.Preferences)
	if err != nil {
		return BootstrapStateDTO{}, err
	}
	app, _ := s.runtimeHandles()
	syncSystemAutostart(app, prefs.LaunchAtStartup)
	return BootstrapStateDTO{
		Bootstrap:   boot,
		Preferences: prefs,
		Storage:     store.getStorageInfo(),
	}, nil
}

func (s *DesktopService) GetStorageInfo() StorageInfo {
	return s.ensureStore().getStorageInfo()
}

func (s *DesktopService) InspectTargetDirectory(targetPath string) TargetDirCheck {
	return s.ensureStore().inspectTargetDir(targetPath)
}

func (s *DesktopService) MigrateDataDirectory(targetPath string, keepSource bool) (MigrationResult, error) {
	return s.ensureStore().migrateDataDir(targetPath, keepSource)
}

func (s *DesktopService) PickDataDirectory() (string, error) {
	app, win := s.runtimeHandles()
	if app == nil {
		return "", errors.New("当前不处于桌面窗口环境")
	}
	dlg := app.Dialog.OpenFile().
		SetTitle("选择 OmniMail 本地数据存储目录").
		SetButtonText("选择此文件夹").
		CanChooseDirectories(true).
		CanChooseFiles(false).
		CanCreateDirectories(true).
		SetDirectory(s.ensureStore().getDataDir())
	if win != nil {
		dlg.AttachToWindow(win)
	}
	return dlg.PromptForSingleSelection()
}

func (s *DesktopService) OpenDataDirectory() error {
	store := s.ensureStore()
	dir := store.getDataDir()
	if err := ensureDataLayout(dir); err != nil {
		return err
	}
	app, _ := s.runtimeHandles()
	if app == nil {
		return errors.New("当前不处于桌面窗口环境")
	}
	return app.Browser.OpenFile(dir)
}

func (s *DesktopService) RestartApplication() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	cmd := exec.Command(exe)
	if err := cmd.Start(); err != nil {
		return err
	}
	s.requestQuit()
	app, _ := s.runtimeHandles()
	if app != nil {
		app.Quit()
	}
	return nil
}
