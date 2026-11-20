//go:build !bindings

package main

import (
	"net/http"
	"net/http/httptest"
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
