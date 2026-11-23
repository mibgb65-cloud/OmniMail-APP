package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

func streamClaudeSSE(
	ctx context.Context,
	baseURL, model, apiKey string,
	messages []ChatMessage,
	onChunk func(string),
) (string, error) {
	var sysPrompt string
	var turns []map[string]string
	for _, m := range messages {
		if m.Role == "system" {
			sysPrompt += m.Content + "\n"
		} else {
			turns = append(turns, map[string]string{"role": m.Role, "content": m.Content})
		}
	}
	bodyMap := map[string]any{
		"model":      model,
		"max_tokens": 2048,
		"stream":     true,
		"messages":   turns,
	}
	if strings.TrimSpace(sysPrompt) != "" {
		bodyMap["system"] = strings.TrimSpace(sysPrompt)
	}
	payload, _ := json.Marshal(bodyMap)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/messages", bytes.NewReader(payload))
	if err != nil {
		return "", mapNetworkError(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", strings.TrimSpace(apiKey))
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := providerHTTPClient(90 * time.Second).Do(req)
	if err != nil {
		return "", mapNetworkError(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return "", mapHTTPStatusError(resp.StatusCode, string(b))
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
		var ev struct {
			Delta struct {
				Text string `json:"text"`
			} `json:"delta"`
		}
		if json.Unmarshal([]byte(data), &ev) == nil && ev.Delta.Text != "" {
			full.WriteString(ev.Delta.Text)
			if onChunk != nil {
				onChunk(ev.Delta.Text)
			}
		}
	}
	if err := sc.Err(); err != nil {
		return "", mapNetworkError(err)
	}
	return full.String(), nil
}

func streamGeminiSSE(
	ctx context.Context,
	baseURL, model, apiKey string,
	messages []ChatMessage,
	onChunk func(string),
) (string, error) {
	var sysText string
	var contents []map[string]any
	for _, m := range messages {
		if m.Role == "system" {
			sysText += m.Content + "\n"
			continue
		}
		role := "user"
		if m.Role == "assistant" {
			role = "model"
		}
		contents = append(contents, map[string]any{
			"role":  role,
			"parts": []map[string]string{{"text": m.Content}},
		})
	}
	bodyMap := map[string]any{"contents": contents}
	if strings.TrimSpace(sysText) != "" {
		bodyMap["systemInstruction"] = map[string]any{
			"parts": []map[string]string{{"text": strings.TrimSpace(sysText)}},
		}
	}
	payload, _ := json.Marshal(bodyMap)

	endpoint := baseURL + "/models/" + url.PathEscape(model) + ":streamGenerateContent?alt=sse"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return "", mapNetworkError(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", strings.TrimSpace(apiKey))

	resp, err := providerHTTPClient(90 * time.Second).Do(req)
	if err != nil {
		return "", mapNetworkError(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return "", mapHTTPStatusError(resp.StatusCode, string(b))
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
		var ev struct {
			Candidates []struct {
				Content struct {
					Parts []struct {
						Text string `json:"text"`
					} `json:"parts"`
				} `json:"content"`
			} `json:"candidates"`
		}
		if json.Unmarshal([]byte(data), &ev) == nil && len(ev.Candidates) > 0 {
			for _, part := range ev.Candidates[0].Content.Parts {
				if part.Text != "" {
					full.WriteString(part.Text)
					if onChunk != nil {
						onChunk(part.Text)
					}
				}
			}
		}
	}
	if err := sc.Err(); err != nil {
		return "", mapNetworkError(err)
	}
	return full.String(), nil
}
