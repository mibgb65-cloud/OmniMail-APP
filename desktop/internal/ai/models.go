package ai

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"slices"
	"sort"
	"strings"
	"time"

	"omnimail/internal/apperr"
)

const (
	maxModelPages = 20
	maxModelCount = 4096
	maxModelJSON  = 2 << 20
)

type modelsPage struct {
	Data []struct {
		ID string `json:"id"`
	} `json:"data"`
	Models []struct {
		Name    string   `json:"name"`
		Methods []string `json:"supportedGenerationMethods"`
	} `json:"models"`
	HasMore  bool   `json:"has_more"`
	LastID   string `json:"last_id"`
	NextPage string `json:"nextPageToken"`
}

func FetchProviderModels(ctx context.Context, cfg ProviderConfig) ([]string, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	return fetchProviderModels(ctx, providerHTTPClient(15*time.Second), cfg)
}

func fetchProviderModels(ctx context.Context, client *http.Client, cfg ProviderConfig) ([]string, error) {
	cfg, err := NormalizeProviderConfig(cfg, false)
	if err != nil {
		return nil, err
	}
	if err := requireProviderKey(cfg); err != nil {
		return nil, err
	}
	ids := make(map[string]struct{})
	cursors := make(map[string]bool)
	var cursor string
	for range maxModelPages {
		page, err := fetchModelsPage(ctx, client, cfg, cursor)
		if err != nil {
			return nil, err
		}
		var more bool
		switch cfg.Provider {
		case "gemini":
			// Gemini 可能省略空的 repeated 字段。
			for _, model := range page.Models {
				if id, ok := strings.CutPrefix(model.Name, "models/"); ok && slices.Contains(model.Methods, "generateContent") {
					addModelID(ids, id, cfg.APIKey)
				}
			}
			cursor, more = page.NextPage, page.NextPage != ""
		default:
			if page.Data == nil {
				return nil, apperr.New(apperr.CodeConnFailed, "端点未返回有效的模型列表，可检查 Base URL 或尝试手动填写模型")
			}
			for _, model := range page.Data {
				addModelID(ids, model.ID, cfg.APIKey)
			}
			cursor, more = page.LastID, cfg.Provider == "claude" && page.HasMore
		}
		if len(ids) > maxModelCount {
			return nil, apperr.New(apperr.CodeConnFailed, "模型列表超出大小上限")
		}
		if !more {
			models := make([]string, 0, len(ids))
			for id := range ids {
				models = append(models, id)
			}
			sort.Strings(models)
			return models, nil
		}
		if cursor == "" || len(cursor) > 1024 || cursors[cursor] {
			return nil, apperr.New(apperr.CodeConnFailed, "模型服务返回了无效的分页信息")
		}
		cursors[cursor] = true
	}
	return nil, apperr.New(apperr.CodeConnFailed, "模型列表页数超出上限")
}

func addModelID(ids map[string]struct{}, id, key string) {
	// 不信任可配置网关或 HTTP 响应中的任意字符串。
	if validModelID(id) && (key == "" || !strings.Contains(id, key)) {
		ids[id] = struct{}{}
	}
}

func fetchModelsPage(ctx context.Context, client *http.Client, cfg ProviderConfig, cursor string) (modelsPage, error) {
	var page modelsPage
	query := url.Values{}
	switch cfg.Provider {
	case "claude":
		if cursor != "" {
			query.Set("after_id", cursor)
		}
	case "gemini":
		query.Set("key", cfg.APIKey)
		if cursor != "" {
			query.Set("pageToken", cursor)
		}
	}
	endpoint := cfg.BaseURL + "/models"
	if len(query) > 0 {
		endpoint += "?" + query.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return page, mapNetworkError(err)
	}
	req.Header.Set("Accept", "application/json")
	switch cfg.Provider {
	case "claude":
		req.Header.Set("x-api-key", cfg.APIKey)
		req.Header.Set("anthropic-version", "2023-06-01")
	case "gemini":
		// Gemini 的发现接口用查询参数；请求 URL 和原始错误一律不对外返回。
	default:
		if cfg.APIKey != "" {
			req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
		}
	}
	resp, err := client.Do(req)
	if err != nil {
		return page, mapNetworkError(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if resp.StatusCode == 404 || resp.StatusCode == 405 {
			return page, apperr.New(apperr.CodeConnFailed, "该端点未提供模型列表接口，请检查 Base URL")
		}
		return page, mapHTTPStatusError(resp.StatusCode, "")
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxModelJSON+1))
	if err != nil {
		return page, mapNetworkError(err)
	}
	if len(raw) > maxModelJSON || json.Unmarshal(raw, &page) != nil {
		return page, apperr.New(apperr.CodeConnFailed, "模型列表格式无效或响应过大")
	}
	return page, nil
}
