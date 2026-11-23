//go:build !bindings

package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func TestCheckConnection(t *testing.T) {
	if got := (&DesktopService{}).CheckConnection(); got != "已成功连接 OmniMail 桌面后端。" {
		t.Fatalf("后端返回了非预期的连通状态：%q", got)
	}
}

func TestEmbeddedFrontend(t *testing.T) {
	t.Setenv("FRONTEND_DEVSERVER_URL", "")
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	application.AssetFileServerFS(assets).ServeHTTP(response, request)

	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), "<title>OmniMail</title>") {
		t.Fatalf("内嵌前端首页不可用：HTTP %d", response.Code)
	}
}

func TestBootstrapAndPreferencesLifecycle(t *testing.T) {
	root := t.TempDir()
	store := &DesktopStateStore{
		configRoot: filepath.Join(root, "appdata"),
		localRoot:  filepath.Join(root, "localappdata"),
		installDir: filepath.Join(root, "ProgramFiles", "OmniMail"),
	}
	svc := NewDesktopService(store, LaunchIntent{MailtoURL: "mailto:hello@studio.example"})

	state := svc.GetBootstrapState()
	if state.Bootstrap.Initialized {
		t.Fatal("初始状态不应标记为 initialized")
	}
	if state.LaunchIntent.MailtoURL != "mailto:hello@studio.example" {
		t.Fatalf("首次读取应携带启动意图：%q", state.LaunchIntent.MailtoURL)
	}

	customData := filepath.Join(root, "DDrive", "OmniMailData")
	done, err := svc.CompleteInitialSetup(InitialSetupInput{
		DataDir: customData,
		Preferences: DesktopPreferences{
			ThemePreference: "dark",
			ResolvedTheme:   "dark",
			Language:        "zh-CN",
			CloseToTray:     false,
			LaunchAtStartup: true,
		},
	})
	if err != nil {
		t.Fatalf("完成初始化引导失败：%v", err)
	}
	if !done.Bootstrap.Initialized || done.Bootstrap.DataDir != customData {
		t.Fatalf("bootstrap.json 数据目录未更新：%+v", done.Bootstrap)
	}

	rawBoot, err := os.ReadFile(store.bootstrapFilePath())
	if err != nil {
		t.Fatalf("读取 bootstrap.json 失败：%v", err)
	}
	var fields map[string]any
	if err := json.Unmarshal(rawBoot, &fields); err != nil || len(fields) < 2 || len(fields) > 4 {
		t.Fatalf("bootstrap.json 应仅包含不超过 4 个极简引导字段：%s", string(rawBoot))
	}

	if svc.SaveThemePreference("invalid-theme") {
		t.Fatal("非法主题参数不应通过可信边界校验")
	}
}

func TestStorageInspectAndMigration(t *testing.T) {
	root := t.TempDir()
	installDir := filepath.Join(root, "AppInstall")
	_ = os.MkdirAll(installDir, 0o700)

	store := &DesktopStateStore{
		configRoot: filepath.Join(root, "roaming"),
		localRoot:  filepath.Join(root, "local"),
		installDir: installDir,
	}
	svc := NewDesktopService(store, LaunchIntent{})

	oldDir := store.getDataDir()
	_ = ensureDataLayout(oldDir)
	sampleMail := filepath.Join(oldDir, "cache", "mail", "msg-001.eml")
	if err := os.WriteFile(sampleMail, []byte("Subject: Migration Test\r\n\r\nHello"), 0o600); err != nil {
		t.Fatal(err)
	}

	if check := svc.InspectTargetDirectory(filepath.Join(installDir, "data")); check.Valid {
		t.Fatal("位于程序安装目录内的路径必须被拒绝")
	}
	if check := svc.InspectTargetDirectory(filepath.Join(oldDir, "nested")); check.Valid {
		t.Fatal("当前数据目录的子目录必须被拒绝")
	}

	targetA := filepath.Join(root, "VolumeD", "MailStoreA")
	resA, err := svc.MigrateDataDirectory(targetA, true)
	if err != nil {
		t.Fatalf("保留原副本迁移失败：%v", err)
	}
	if resA.NewDataDir != targetA || store.getDataDir() != targetA {
		t.Fatalf("迁移后 getDataDir() 未切换至新路径：%s", store.getDataDir())
	}
	if _, err := os.Stat(filepath.Join(targetA, "cache", "mail", "msg-001.eml")); err != nil {
		t.Fatalf("新目录缺少迁移后的邮件缓存文件：%v", err)
	}
	if _, err := os.Stat(sampleMail); err != nil {
		t.Fatal("keepSource=true 时原目录副本不应被删除")
	}

	targetB := filepath.Join(root, "VolumeE", "MailStoreB")
	if _, err := svc.MigrateDataDirectory(targetB, false); err != nil {
		t.Fatalf("清理原副本迁移失败：%v", err)
	}
	if _, err := os.Stat(targetA); !os.IsNotExist(err) {
		t.Fatal("keepSource=false 时原目录应在切换成功后清理")
	}
}

func TestWindowGeometryAndLaunchFlags(t *testing.T) {
	clamped := normalizeWindowGeometry(WindowGeometryState{
		X: -32000, Y: -32000, Width: 640, Height: 480, HasPos: true, Maximised: true,
	})
	if clamped.Width < 960 || clamped.Height < 640 || clamped.HasPos {
		t.Fatalf("窗口尺寸或异常最小化坐标未正确修正：%+v", clamped)
	}
	if !isSilentAutostart([]string{"--autostart"}) || isSilentAutostart([]string{"--normal"}) {
		t.Fatal("静默启动参数识别异常")
	}
	emlPath := filepath.Join(t.TempDir(), "invite.ics")
	intent := extractLaunchIntent([]string{"mailto:team@omni.example", emlPath})
	if intent.MailtoURL != "mailto:team@omni.example" || intent.FilePath != emlPath {
		t.Fatalf("启动协议/文件关联参数解析错误：%+v", intent)
	}
	if !shouldHideMainWindowOnBoot([]string{"--autostart", "--silent-tray"}, DesktopPreferences{}) {
		t.Fatal("--silent-tray 参数应静默隐藏主窗口至托盘")
	}
	if shouldHideMainWindowOnBoot([]string{"--autostart"}, DesktopPreferences{SilentStartToTray: false}) {
		t.Fatal("未开启静默托盘时仅 --autostart 不应强制隐藏主窗口")
	}
	if !isQuitExistingRequest([]string{"--quit-existing"}) {
		t.Fatal("安装器温和退出参数识别失败")
	}
}

func TestDualTrackVersionComparisonAndBuildInfo(t *testing.T) {
	origVer, origCh, origBt := AppVersion, ReleaseChannel, BuildTime
	t.Cleanup(func() {
		AppVersion, ReleaseChannel, BuildTime = origVer, origCh, origBt
	})

	AppVersion = "v0.0.1.beta.1"
	ReleaseChannel = "beta"
	BuildTime = "2026-11-23T10:30:00Z"

	info := (&DesktopService{}).GetAppBuildInfo()
	if info.Version != "v0.0.1.beta.1" || info.Channel != "beta" || !info.IsBeta {
		t.Fatalf("Beta 构建信息解析异常：%+v", info)
	}
	if !isNewerReleaseVersion("v0.0.1.beta.1", "v0.0.1.beta.2") {
		t.Fatal("v0.0.1.beta.2 应新于 v0.0.1.beta.1")
	}
	if !isNewerReleaseVersion("v0.0.1.beta.2", "v0.0.1") {
		t.Fatal("同主版本正式版 v0.0.1 应新于测试版 v0.0.1.beta.2")
	}
	if isNewerReleaseVersion("v0.0.1", "v0.0.1.beta.9") {
		t.Fatal("测试版不应被判定为新于同版本正式版")
	}
	if !isNewerReleaseVersion("v0.0.1", "v0.0.2.beta.1") {
		t.Fatal("更高补丁号测试版 v0.0.2.beta.1 应新于 v0.0.1")
	}
}
