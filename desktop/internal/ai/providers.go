package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"omnimail/internal/apperr"
)

type ProviderConfig struct {
	Provider string
	Model    string
	BaseURL  string
	APIKey   string
}

type ProviderError struct {
	RunStatus string
	Message   string
}

func (e *ProviderError) Error() string {
	return e.Message
}

func StreamChat(ctx context.Context, cfg ProviderConfig, messages []ChatMessage, onChunk func(delta string)) (string, error) {
	cfg, err := NormalizeProviderConfig(cfg, true)
	if err != nil {
		return "", err
	}
	if err := requireProviderKey(cfg); err != nil {
		return "", err
	}
	base := cfg.BaseURL
	switch cfg.Provider {
	case "claude":
		return streamClaudeSSE(ctx, base, cfg.Model, cfg.APIKey, messages, onChunk)
	case "gemini":
		return streamGeminiSSE(ctx, base, cfg.Model, cfg.APIKey, messages, onChunk)
	default:
		return streamOpenAICompatSSE(ctx, base, cfg.Model, cfg.APIKey, messages, onChunk)
	}
}

func TestProvider(ctx context.Context, cfg ProviderConfig) (TestResult, error) {
	start := time.Now()
	testCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	out, err := StreamChat(testCtx, cfg, []ChatMessage{
		{Role: "user", Content: "Reply with OK only."},
	}, nil)
	lat := time.Since(start).Milliseconds()
	if err != nil {
		var pe *ProviderError
		if errors.As(err, &pe) {
			return TestResult{OK: false, Status: pe.RunStatus, LatencyMs: lat, Message: pe.Message}, nil
		}
		var ae *apperr.AppError
		if errors.As(err, &ae) {
			return TestResult{OK: false, Status: "error", LatencyMs: lat, Message: ae.Message}, nil
		}
		return TestResult{OK: false, Status: "error", LatencyMs: lat, Message: "模型未能返回测试响应，请检查端点与模型配置"}, nil
	}
	if strings.TrimSpace(out) == "" {
		return TestResult{OK: false, Status: "error", LatencyMs: lat, Message: "端点没有返回模型响应，请确认该模型支持对话与流式输出"}, nil
	}
	return TestResult{
		OK:        true,
		Status:    "idle",
		LatencyMs: lat,
		Message:   fmt.Sprintf("连接成功（耗时 %d ms）", lat),
	}, nil
}

func streamOpenAICompatSSE(
	ctx context.Context,
	baseURL, model, apiKey string,
	messages []ChatMessage,
	onChunk func(string),
) (string, error) {
	payload, _ := json.Marshal(map[string]any{
		"model":       model,
		"messages":    messages,
		"stream":      true,
		"temperature": 0.3,
	})
	endpoint := baseURL + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return "", mapNetworkError(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	if strings.TrimSpace(apiKey) != "" {
		req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(apiKey))
	}

	resp, err := providerHTTPClient(90 * time.Second).Do(req)
	if err != nil {
		return "", mapNetworkError(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return "", mapHTTPStatusError(resp.StatusCode, string(body))
	}

	var full strings.Builder
	sc := bufio.NewScanner(resp.Body)
	sc.Buffer(make([]byte, 0, 64*1024), 512*1024)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "" || data == "[DONE]" {
			continue
		}
		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if json.Unmarshal([]byte(data), &chunk) == nil && len(chunk.Choices) > 0 {
			delta := chunk.Choices[0].Delta.Content
			if delta != "" {
				full.WriteString(delta)
				if onChunk != nil {
					onChunk(delta)
				}
			}
		}
	}
	if err := sc.Err(); err != nil {
		return "", mapNetworkError(err)
	}
	return full.String(), nil
}

func mapHTTPStatusError(code int, rawBody string) error {
	lower := strings.ToLower(rawBody)
	switch {
	case code == 401 || code == 403:
		return &ProviderError{RunStatus: "invalid-key", Message: fmt.Sprintf("API Key 无效或权限不足 (HTTP %d)", code)}
	case code == 429 || strings.Contains(lower, "insufficient_quota") || strings.Contains(lower, "balance"):
		return &ProviderError{RunStatus: "quota-exceeded", Message: "模型额度不足或触发限流 (HTTP 429)，请稍后再试或切换本地 Ollama"}
	case code >= 500:
		return &ProviderError{RunStatus: "unavailable", Message: fmt.Sprintf("上游模型服务暂时不可用 (HTTP %d)", code)}
	default:
		return &ProviderError{RunStatus: "error", Message: fmt.Sprintf("模型请求失败（HTTP %d），请检查所选端点和模型", code)}
	}
}

func mapNetworkError(err error) error {
	if errors.Is(err, context.Canceled) {
		return context.Canceled
	}
	var timeout interface{ Timeout() bool }
	if errors.Is(err, context.DeadlineExceeded) || (errors.As(err, &timeout) && timeout.Timeout()) {
		return &ProviderError{RunStatus: "unavailable", Message: "模型服务请求超时，请检查网络后重试"}
	}
	return &ProviderError{
		RunStatus: "unavailable",
		Message:   "无法连接到模型服务，请检查网络、端点或本地服务是否已启动",
	}
}
