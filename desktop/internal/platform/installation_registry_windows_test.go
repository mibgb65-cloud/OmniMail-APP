//go:build windows

package platform

import (
	"crypto/rand"
	"testing"

	"golang.org/x/sys/windows/registry"
)

func TestInstallationRecordIsolation(t *testing.T) {
	for _, test := range []struct {
		name                  string
		legacyData, marker    bool
		primaryData, partial  bool
		wantRecord, wantError bool
	}{
		{name: "仅开发运行父键与子键"},
		{name: "开发旧键有路径但无生产卸载标记", legacyData: true},
		{name: "生产专用元数据", primaryData: true, wantRecord: true},
		{name: "生产元数据不完整", partial: true, wantError: true},
		{name: "已确认的旧生产安装", legacyData: true, marker: true, wantRecord: true},
		{name: "生产卸载标记存在但元数据丢失", marker: true, wantError: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			// 所有写操作都位于随机测试键，不改真实 OmniMail/Run/卸载记录。
			base := `Software\OmniMail-Installation-Test-` + rand.Text()
			var created []string
			t.Cleanup(func() {
				for i := len(created) - 1; i >= 0; i-- {
					if err := registry.DeleteKey(registry.CURRENT_USER, created[i]); err != nil {
						t.Errorf("清除本轮测试键失败: %v", err)
					}
				}
			})
			makeKey := func(path string, values map[string]string) {
				t.Helper()
				key, _, err := registry.CreateKey(registry.CURRENT_USER, path, registry.SET_VALUE)
				if err != nil {
					t.Fatal(err)
				}
				created = append(created, path)
				for name, value := range values {
					if err := key.SetStringValue(name, value); err != nil {
						key.Close()
						t.Fatal(err)
					}
				}
				if err := key.Close(); err != nil {
					t.Fatal(err)
				}
			}
			makeKey(base, nil)
			legacy := base + `\Runtime`
			primary := legacy + `\Installation`
			marker := base + `\ProductUninstall`
			values := map[string]string{"InstallDir": `E:\RegressionApp`, "DataDir": `E:\RegressionData`, "Language": "en", "Version": "0.0.1"}
			if test.legacyData {
				makeKey(legacy, values)
			} else {
				makeKey(legacy, nil)
			}
			makeKey(legacy+`\OmniMailDesktop`, nil)
			if test.primaryData {
				makeKey(primary, values)
			} else if test.partial {
				makeKey(primary, map[string]string{"InstallDir": `E:\RegressionApp`})
			}
			if test.marker {
				makeKey(marker, nil)
			}
			got, err := readInstallationKeys(primary, legacy, marker)
			if (err != nil) != test.wantError {
				t.Fatalf("安装判定错误: %v", err)
			}
			if err == nil && ((got.InstallDir != "") != test.wantRecord) {
				t.Fatalf("开发/生产记录串用: %+v", got)
			}
		})
	}
}
