package main

import (
	"errors"
	"os"
	"strings"
)

func (s *DesktopStateStore) migrateDataDir(rawTarget string, keepSource bool) (MigrationResult, error) {
	check := s.inspectTargetDir(rawTarget)
	if !check.Valid {
		return MigrationResult{}, errors.New(check.Message)
	}
	if check.SameAsCurrent {
		return MigrationResult{}, errors.New("新目录与当前数据目录一致，无需迁移")
	}

	s.mu.RLock()
	beforeFn := s.beforeMigrate
	afterFn := s.afterMigrate
	s.mu.RUnlock()

	if beforeFn != nil {
		beforeFn()
	}

	s.mu.Lock()
	boot := s.readBootstrapUnlocked()
	oldDir := boot.DataDir
	newDir := check.NormalizedPath

	if err := ensureDataLayout(oldDir); err != nil {
		s.mu.Unlock()
		if afterFn != nil {
			_ = afterFn()
		}
		return MigrationResult{}, err
	}
	if err := ensureDataLayout(newDir); err != nil {
		s.mu.Unlock()
		if afterFn != nil {
			_ = afterFn()
		}
		return MigrationResult{}, err
	}

	files, copiedBytes, err := copyDirectoryTree(oldDir, newDir)
	if err != nil {
		s.mu.Unlock()
		if afterFn != nil {
			_ = afterFn()
		}
		return MigrationResult{}, errors.New("迁移复制数据文件失败：" + err.Error())
	}

	nextBoot := BootstrapConfig{
		DataDir:         newDir,
		Initialized:     true,
		ActiveProfileID: boot.ActiveProfileID,
		LaunchBehavior:  boot.LaunchBehavior,
	}
	if err := s.writeBootstrapUnlocked(nextBoot); err != nil {
		s.mu.Unlock()
		if afterFn != nil {
			_ = afterFn()
		}
		return MigrationResult{}, errors.New("更新引导配置 bootstrap.json 失败")
	}
	s.mu.Unlock()

	if !keepSource && !strings.EqualFold(oldDir, newDir) {
		_ = os.RemoveAll(oldDir)
	}
	if afterFn != nil {
		_ = afterFn()
	}

	return MigrationResult{
		OldDataDir:  oldDir,
		NewDataDir:  newDir,
		CopiedFiles: files,
		CopiedBytes: copiedBytes,
		KeptSource:  keepSource,
	}, nil
}

func (s *DesktopStateStore) commitInitialSetup(rawDataDir string, prefs DesktopPreferences) (BootstrapConfig, DesktopPreferences, error) {
	targetDir := strings.TrimSpace(rawDataDir)
	if targetDir == "" {
		targetDir = s.getDataDir()
	}
	check := s.inspectTargetDir(targetDir)
	if !check.Valid {
		return BootstrapConfig{}, DesktopPreferences{}, errors.New(check.Message)
	}

	s.mu.RLock()
	beforeFn := s.beforeMigrate
	afterFn := s.afterMigrate
	s.mu.RUnlock()

	if !check.SameAsCurrent && beforeFn != nil {
		beforeFn()
	}

	s.mu.Lock()
	oldBoot := s.readBootstrapUnlocked()
	if !check.SameAsCurrent {
		if _, err := os.Stat(oldBoot.DataDir); err == nil {
			_, _, _ = copyDirectoryTree(oldBoot.DataDir, check.NormalizedPath)
		}
	}
	if err := ensureDataLayout(check.NormalizedPath); err != nil {
		s.mu.Unlock()
		return BootstrapConfig{}, DesktopPreferences{}, err
	}
	nextBoot := BootstrapConfig{
		DataDir:         check.NormalizedPath,
		Initialized:     true,
		ActiveProfileID: oldBoot.ActiveProfileID,
		LaunchBehavior:  oldBoot.LaunchBehavior,
	}
	if err := s.writeBootstrapUnlocked(nextBoot); err != nil {
		s.mu.Unlock()
		return BootstrapConfig{}, DesktopPreferences{}, err
	}
	s.mu.Unlock()

	savedPrefs, err := s.savePreferences(prefs)
	if err != nil {
		return BootstrapConfig{}, DesktopPreferences{}, err
	}
	if afterFn != nil {
		_ = afterFn()
	}
	return nextBoot, savedPrefs, nil
}
