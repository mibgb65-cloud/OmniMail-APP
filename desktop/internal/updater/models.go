package updater

// UpdateCheckResult 描述一次版本更新检测的完整结果与匹配到的安装包资产。
type UpdateCheckResult struct {
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	Channel        string `json:"channel"`
	HasUpdate      bool   `json:"hasUpdate"`
	Skipped        bool   `json:"skipped"`
	ReleaseURL     string `json:"releaseUrl"`
	ReleaseNotes   string `json:"releaseNotes"`
	PublishedAt    string `json:"publishedAt"`
	CheckedAt      string `json:"checkedAt"`
	CheckedAtUnix  int64  `json:"checkedAtUnix"`
	AssetName      string `json:"assetName"`
	AssetURL       string `json:"assetUrl"`
	AssetSize      int64  `json:"assetSize"`
	SumsURL        string `json:"sumsUrl"`
	ErrorMessage   string `json:"errorMessage,omitempty"`
}

// UpdatePreferencesDTO 保存桌面端自动检测、更新通道与已跳过版本偏好。
type UpdatePreferencesDTO struct {
	AutoCheckUpdates  bool   `json:"autoCheckUpdates"`
	UpdateChannel     string `json:"updateChannel"`
	SkippedVersion    string `json:"skippedVersion"`
	LastUpdateCheckAt int64  `json:"lastUpdateCheckAt"`
}

// UpdateDownloadRequest 描述后台流式下载更新安装包与校验文件的请求参数。
type UpdateDownloadRequest struct {
	Version     string `json:"version"`
	AssetName   string `json:"assetName"`
	AssetURL    string `json:"assetUrl"`
	AssetSize   int64  `json:"assetSize"`
	SumsURL     string `json:"sumsUrl"`
	AutoInstall bool   `json:"autoInstall"`
}

// ProgressPayload 通过 Wails 事件 updater:progress 实时推送后台更新阶段与速度。
type ProgressPayload struct {
	Stage           string `json:"stage"`
	Version         string `json:"version,omitempty"`
	DownloadedBytes int64  `json:"downloadedBytes"`
	TotalBytes      int64  `json:"totalBytes"`
	SpeedBps        int64  `json:"speedBps"`
	Percent         int    `json:"percent"`
	SHA256          string `json:"sha256,omitempty"`
	FilePath        string `json:"filePath,omitempty"`
	AutoInstall     bool   `json:"autoInstall,omitempty"`
	Error           string `json:"error,omitempty"`
}

// LocalInstallInfo 描述当前运行实例对应的 NSIS 安装目录与权限模式。
type LocalInstallInfo struct {
	IsInstalled bool
	InstallDir  string
	InstallMode string
}
