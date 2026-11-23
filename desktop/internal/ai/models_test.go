package ai

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"

	"omnimail/internal/config"
)

type modelTransport func(*http.Request) (*http.Response, error)

func (f modelTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestOfficialModelProtocols(t *testing.T) {
	const key = "fixture-token-for-tests"
	for _, provider := range []string{"openai", "deepseek", "claude", "gemini"} {
		t.Run(provider, func(t *testing.T) {
			calls := 0
			client := &http.Client{Transport: modelTransport(func(r *http.Request) (*http.Response, error) {
				calls++
				if r.Method != http.MethodGet || r.URL.Scheme+"://"+r.URL.Host+r.URL.Path != config.AiPresetBaseURL(provider)+"/models" {
					t.Fatalf("官方端点未锁定：%s %s", r.Method, r.URL.Path)
				}
				body := `{"data":[{"id":"z-model"},{"id":"a-model"},{"id":"a-model"},{"id":"` + key + `"},{"id":"not a model"}]}`
				switch provider {
				case "claude":
					if r.Header.Get("x-api-key") != key || r.Header.Get("anthropic-version") != "2023-06-01" {
						t.Fatal("Anthropic 认证头不符")
					}
					if calls == 1 {
						body = `{"data":[{"id":"z-model"}],"has_more":true,"last_id":"z-model"}`
					} else if r.URL.Query().Get("after_id") != "z-model" {
						t.Fatal("Anthropic 分页参数不符")
					}
				case "gemini":
					if r.URL.Query().Get("key") != key {
						t.Fatal("Gemini 认证参数不符")
					}
					if calls == 1 {
						body = `{"models":[{"name":"models/z-model","supportedGenerationMethods":["generateContent"]},{"name":"models/embedding","supportedGenerationMethods":["embedContent"]}],"nextPageToken":"p2"}`
					} else {
						if r.URL.Query().Get("pageToken") != "p2" {
							t.Fatal("Gemini 分页参数不符")
						}
						body = `{"models":[{"name":"models/a-model","supportedGenerationMethods":["generateContent"]},{"name":"models/z-model","supportedGenerationMethods":["generateContent"]}]}`
					}
				default:
					if r.Header.Get("Authorization") != "Bearer "+key {
						t.Fatal("Bearer 认证头不符")
					}
				}
				return &http.Response{StatusCode: http.StatusOK, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(body))}, nil
			})}
			got, err := fetchProviderModels(context.Background(), client, ProviderConfig{
				Provider: provider, BaseURL: "http://127.0.0.1:4321/wrong", APIKey: key,
			})
			if err != nil || !reflect.DeepEqual(got, []string{"a-model", "z-model"}) {
				t.Fatalf("模型列表应规范化并去重排序，实际 %v：%v", got, err)
			}
		})
	}
}

func TestCompatibleModelDiscoveryWithoutKeyAndNoRedirect(t *testing.T) {
	var redirected atomic.Bool
	redirectTarget := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		redirected.Store(true)
		w.WriteHeader(http.StatusOK)
	}))
	defer redirectTarget.Close()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/models":
			if r.Header.Get("Authorization") != "" {
				t.Error("免密端点不应带认证头")
			}
			_, _ = io.WriteString(w, `{"data":[{"id":"qwen2.5:7b"}]}`)
		case "/redirect/models":
			http.Redirect(w, r, redirectTarget.URL, http.StatusTemporaryRedirect)
		case "/denied/models":
			http.Error(w, "上游返回的内容不能显示", http.StatusUnauthorized)
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	for _, provider := range []string{"custom", "ollama"} {
		got, err := FetchProviderModels(context.Background(), ProviderConfig{Provider: provider, BaseURL: srv.URL + "/v1"})
		if err != nil || !reflect.DeepEqual(got, []string{"qwen2.5:7b"}) {
			t.Fatalf("%s 免密拉取失败：%v %v", provider, got, err)
		}
	}
	for _, path := range []string{"/redirect", "/denied", "/unsupported"} {
		_, err := FetchProviderModels(context.Background(), ProviderConfig{
			Provider: "custom", BaseURL: srv.URL + path, APIKey: "local-test-key",
		})
		if err == nil || strings.Contains(err.Error(), "local-test-key") || strings.Contains(err.Error(), "上游返回的内容") {
			t.Fatalf("%s 未正确返回脱敏错误", path)
		}
		if path == "/denied" && !strings.Contains(err.Error(), "权限不足") {
			t.Fatal("401 应报告密钥或权限问题")
		}
	}
	if redirected.Load() {
		t.Fatal("不应向跳转目标发送请求")
	}
}

func TestGeminiModelNetworkErrorDoesNotExposeQueryKey(t *testing.T) {
	const secret = "gemini-test-fixture"
	client := &http.Client{Transport: modelTransport(func(r *http.Request) (*http.Response, error) {
		return nil, fmt.Errorf("上游网络失败：%s", r.URL.String())
	})}
	_, err := fetchProviderModels(context.Background(), client, ProviderConfig{Provider: "gemini", APIKey: secret})
	if err == nil || strings.Contains(err.Error(), secret) || !strings.Contains(err.Error(), "无法连接") {
		t.Fatal("网络错误不应泄露密钥")
	}
	var providerErr *ProviderError
	if !errors.As(err, &providerErr) || providerErr.RunStatus != "unavailable" {
		t.Fatal("应识别为网络不可用")
	}
}
