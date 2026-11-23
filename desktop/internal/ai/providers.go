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

	"omnimail/internal/security"
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
	prov := strings.ToLower(strings.TrimSpace(cfg.Provider))
	base := strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	if base == "" {
		base = DefaultBaseURL(prov)
	}
	if prov != "ollama" && prov != "custom" && strings.TrimSpace(cfg.APIKey) == "" {
		return "", &ProviderError{RunStatus: "invalid-key", Message: "尚未配置模型 API Key，请前往「设置 → AI 配置」填写"}
	}
	switch prov {
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

	var full string
	out, err := StreamChat(testCtx, cfg, []ChatMessage{
		{Role: "user", Content: "Reply with OK only."},
	}, func(delta string) { full += delta })
	lat := time.Since(start).Milliseconds()
	if err != nil {
		var pe *ProviderError
		if errors.As(err, &pe) {
			return TestResult{OK: false, Status: pe.RunStatus, LatencyMs: lat, Message: pe.Message}, nil
		}
		return TestResult{OK: false, Status: "error", LatencyMs: lat, Message: security.RedactSensitive(err.Error())}, nil
	}
	if out == "" {
		out = full
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
	if strings.TrimSpace(model) == "" {
		model = "gpt-4o-mini"
	}
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

	resp, err := (&http.Client{Timeout: 90 * time.Second}).Do(req)
	if err != nil {
		return "", mapNetworkError(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
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
	return full.String(), sc.Err()
}

func mapHTTPStatusError(code int, rawBody string) error {
	clean := security.RedactSensitive(strings.TrimSpace(rawBody))
	if len(clean) > 180 {
		clean = clean[:180]
	}
	switch {
	case code == 401 || code == 403:
		return &ProviderError{RunStatus: "invalid-key", Message: fmt.Sprintf("API Key 无效或权限不足 (HTTP %d)", code)}
	case code == 429 || strings.Contains(strings.ToLower(clean), "insufficient_quota") || strings.Contains(strings.ToLower(clean), "balance"):
		return &ProviderError{RunStatus: "quota-exceeded", Message: "模型额度不足或触发限流 (HTTP 429)，请稍后再试或切换本地 Ollama"}
	case code >= 500:
		return &ProviderError{RunStatus: "unavailable", Message: fmt.Sprintf("上游模型服务暂时不可用 (HTTP %d)", code)}
	default:
		return &ProviderError{RunStatus: "error", Message: fmt.Sprintf("模型请求失败 (HTTP %d): %s", code, clean)}
	}
}

func mapNetworkError(err error) error {
	if errors.Is(err, context.Canceled) {
		return context.Canceled
	}
	return &ProviderError{
		RunStatus: "unavailable",
		Message:   "无法连接到模型服务（若使用本地 Ollama，请确认 127.0.0.1:11434 已启动）: " + security.RedactSensitive(err.Error()),
	}
}
