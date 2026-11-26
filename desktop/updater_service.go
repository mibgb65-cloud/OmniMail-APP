package main

import (
	"context"
	"os"
	"strings"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/updater"
)

type UpdateCheckResult = updater.UpdateCheckResult
type UpdatePreferencesDTO = updater.UpdatePreferencesDTO
type UpdateDownloadRequest = updater.UpdateDownloadRequest

// GetUpdatePreferences 返回持久化的自动更新检测、渠道与跳过版本配置。
func (s *DesktopService) GetUpdatePreferences() UpdatePreferencesDTO {
	prefs := s.ensureStore().readPreferences()
	return UpdatePreferencesDTO{
		AutoCheckUpdates:  prefs.AutoCheckUpdates,
		UpdateChannel:     sanitizeUpdateChannel(prefs.UpdateChannel),
		SkippedVersion:    prefs.SkippedVersion,
		LastUpdateCheckAt: prefs.LastUpdateCheckAt,
	}
}

// UpdateUpdatePreferences 更新并持久化自动检测开关与更新发布通道偏好。
func (s *DesktopService) UpdateUpdatePreferences(in UpdatePreferencesDTO) (UpdatePreferencesDTO, error) {
	store := s.ensureStore()
	cur := store.readPreferences()
	cur.AutoCheckUpdates = in.AutoCheckUpdates
	cur.UpdateChannel = sanitizeUpdateChannel(in.UpdateChannel)
	if in.SkippedVersion != "" {
		cur.SkippedVersion = updater.NormalizeVersion(in.SkippedVersion)
	}
	saved, err := store.savePreferences(cur)
	if err != nil {
		return UpdatePreferencesDTO{}, err
	}
	return UpdatePreferencesDTO{
		AutoCheckUpdates:  saved.AutoCheckUpdates,
		UpdateChannel:     saved.UpdateChannel,
		SkippedVersion:    saved.SkippedVersion,
		LastUpdateCheckAt: saved.LastUpdateCheckAt,
	}, nil
}

// SkipUpdateVersion 记录用户跳过的指定新版本号（手动传空字符串可清除跳过记录）。
func (s *DesktopService) SkipUpdateVersion(version string) error {
	store := s.ensureStore()
	cur := store.readPreferences()
	trimmed := strings.TrimSpace(version)
	if trimmed == "" {
		cur.SkippedVersion = ""
	} else {
		cur.SkippedVersion = updater.NormalizeVersion(trimmed)
	}
	_, err := store.savePreferences(cur)
	return err
}

// CheckForUpdates 按指定通道（空则使用偏好通道）执行 Release 检测，并如实上报网络或协议错误。
func (s *DesktopService) CheckForUpdates(channel string, manual bool) (UpdateCheckResult, error) {
	store := s.ensureStore()
	prefs := store.readPreferences()
	targetChannel := strings.TrimSpace(channel)
	if targetChannel == "" {
		targetChannel = prefs.UpdateChannel
	}
	targetChannel = sanitizeUpdateChannel(targetChannel)

	res, err := updater.CheckRelease(context.Background(), updater.CheckConfig{
		CurrentVersion: normalizedAppVersion(),
		Channel:        targetChannel,
		Repo:           normalizedReleaseRepo(),
		FeedURL:        strings.TrimSpace(os.Getenv("OMNIMAIL_RELEASE_FEED_URL")),
		Timeout:        10 * time.Second,
	})
	if err != nil {
		return res, apperr.Wrap(apperr.CodeConnFailed, res.ErrorMessage, err)
	}

	nowMs := time.Now().UnixMilli()
	latestPrefs := store.readPreferences()
	latestPrefs.LastUpdateCheckAt = nowMs
	if manual && res.HasUpdate && strings.EqualFold(res.LatestVersion, latestPrefs.SkippedVersion) {
		// 手动主动检查时保留 Skipped 标记供前端提示，但不静默屏蔽
	}
	_, _ = store.savePreferences(latestPrefs)

	res.CheckedAtUnix = nowMs
	res.Skipped = res.HasUpdate &&
		latestPrefs.SkippedVersion != "" &&
		strings.EqualFold(res.LatestVersion, latestPrefs.SkippedVersion)
	return res, nil
}

// DownloadUpdate 在受信任 HTTPS 域名白名单下启动后台流式下载与 SHA-256 强校验。
func (s *DesktopService) DownloadUpdate(req UpdateDownloadRequest) error {
	feedOverride := strings.TrimSpace(os.Getenv("OMNIMAIL_RELEASE_FEED_URL"))
	ua := "OmniMail-Desktop/" + normalizedAppVersion()
	if err := s.ensureUpdater().StartDownload(req, feedOverride, ua); err != nil {
		return apperr.New(apperr.CodeInvalidInput, err.Error())
	}
	return nil
}

// CancelUpdateDownload 取消正在进行的更新包下载并清理 .part 临时文件。
func (s *DesktopService) CancelUpdateDownload() error {
	s.ensureUpdater().CancelDownload()
	return nil
}

// InstallDownloadedUpdate 严格复核已下载安装包哈希，唤起 NSIS 静默覆盖安装并优雅退出当前进程。
func (s *DesktopService) InstallDownloadedUpdate(filePath string, silent bool) error {
	mgr := s.ensureUpdater()
	cleanPath, shaHex, err := mgr.EnsureVerified(filePath)
	if err != nil {
		return apperr.New(apperr.CodeInvalidInput, err.Error())
	}

	exePath, _ := os.Executable()
	installInfo := updater.DetectLocalInstall(exePath)

	// 若当前运行于未安装的开发目录或便携副本，降级为交互式安装或定位目录，避免误覆盖开发目录
	if !installInfo.IsInstalled && silent {
		if err := updater.LaunchInstaller(cleanPath, updater.LocalInstallInfo{InstallMode: "CurrentUser"}, false); err != nil {
			_ = updater.RevealInstallerInExplorer(cleanPath)
			return apperr.New(apperr.CodeInternal, "当前为未安装的开发/便携运行环境，已为你打开安装包所在目录")
		}
		s.quitGracefully()
		return nil
	}

	mgr.EmitStage(updater.ProgressPayload{
		Stage:    "installing",
		SHA256:   shaHex,
		FilePath: cleanPath,
		Percent:  100,
	})

	if err := updater.LaunchInstaller(cleanPath, installInfo, silent); err != nil {
		mgr.EmitStage(updater.ProgressPayload{
			Stage:    "error",
			SHA256:   shaHex,
			FilePath: cleanPath,
			Error:    "启动安装程序失败：" + err.Error(),
		})
		return apperr.Wrap(apperr.CodeInternal, "启动更新安装程序失败，可打开目录手动安装", err)
	}

	s.quitGracefully()
	return nil
}

// OpenUpdateDownloadDir 在系统资源管理器中定位已下载的更新安装包。
func (s *DesktopService) OpenUpdateDownloadDir(filePath string) error {
	trimmed := strings.TrimSpace(filePath)
	if trimmed != "" {
		cleanPath, err := updater.ValidateInstallerInTempDir(trimmed)
		if err != nil {
			return apperr.New(apperr.CodeInvalidInput, err.Error())
		}
		return updater.RevealInstallerInExplorer(cleanPath)
	}
	return updater.RevealInstallerInExplorer("")
}

func (s *DesktopService) quitGracefully() {
	s.requestQuit()
	app, _ := s.runtimeHandles()
	if app != nil {
		app.Quit()
	}
}
