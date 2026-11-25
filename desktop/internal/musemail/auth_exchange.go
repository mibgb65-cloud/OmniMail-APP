package musemail

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"regexp"
	"strings"
)

const maxAuthResponseBytes = 64 * 1024

var validVMIDPattern = regexp.MustCompile(`^[A-Za-z0-9._-]{1,128}$`)

type sessionTokens struct {
	VMID        string
	AccessToken string
	HatchToken  string
}

func exchangeGatewayTokens(ctx context.Context, client *http.Client, baseURL, cookieHeader string) (sessionTokens, error) {
	if strings.TrimSpace(cookieHeader) == "" {
		return sessionTokens{}, errNotLoggedIn()
	}
	if baseURL == "" {
		baseURL = defaultMuseOrigin
	}
	baseURL = strings.TrimRight(baseURL, "/")

	vmID, err := fetchSessionVMID(ctx, client, baseURL, cookieHeader)
	if err != nil {
		return sessionTokens{}, err
	}
	accessToken, err := fetchAccessToken(ctx, client, baseURL, cookieHeader)
	if err != nil {
		return sessionTokens{}, err
	}
	hatchToken, err := fetchHatchToken(ctx, client, baseURL, cookieHeader, accessToken, vmID)
	if err != nil {
		return sessionTokens{}, err
	}
	return sessionTokens{VMID: vmID, AccessToken: accessToken, HatchToken: hatchToken}, nil
}

func applyHatchHeaders(req *http.Request, cookieHeader, accessToken string) {
	req.Header.Set("User-Agent", museBrowserUA)
	req.Header.Set("Referer", defaultMuseOrigin+"/")
	req.Header.Set("Origin", defaultMuseOrigin)
	req.Header.Set("Sec-Fetch-Site", "same-origin")
	req.Header.Set("Sec-Fetch-Mode", "cors")
	req.Header.Set("Sec-Fetch-Dest", "empty")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Cookie", cookieHeader)
	if accessToken != "" {
		req.Header.Set("Authorization", "Bearer "+accessToken)
	}
}

func readBoundedHTTPBody(resp *http.Response) ([]byte, error) {
	defer resp.Body.Close()
	lr := io.LimitReader(resp.Body, maxAuthResponseBytes+1)
	raw, err := io.ReadAll(lr)
	if err != nil {
		return nil, classifyContextOrNetErr(err)
	}
	if len(raw) > maxAuthResponseBytes {
		return nil, errGatewayFailed("认证响应超出安全大小上限")
	}
	return raw, nil
}

func fetchSessionVMID(ctx context.Context, client *http.Client, baseURL, cookieHeader string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/api/session", nil)
	if err != nil {
		return "", errGatewayFailed("")
	}
	applyHatchHeaders(req, cookieHeader, "")
	resp, err := client.Do(req)
	if err != nil {
		return "", classifyContextOrNetErr(err)
	}
	raw, err := readBoundedHTTPBody(resp)
	if err != nil {
		return "", err
	}
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return "", errAuthExpired()
	}
	if resp.StatusCode != http.StatusOK {
		return "", errGatewayFailed("获取 Muse 会话信息失败")
	}
	var payload struct {
		VMID   string `json:"vm_id"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return "", errAuthExpired()
	}
	vmID := strings.TrimSpace(payload.VMID)
	if vmID == "" {
		if payload.Status == "unavailable" {
			return "", errGatewayFailed("Muse 个人实例正在唤醒或暂不可用，请稍后重试")
		}
		return "", errAuthExpired()
	}
	if !validVMIDPattern.MatchString(vmID) {
		return "", errGatewayFailed("网关实例标识格式异常")
	}
	return vmID, nil
}

func fetchAccessToken(ctx context.Context, client *http.Client, baseURL, cookieHeader string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/api/auth/check", bytes.NewReader(nil))
	if err != nil {
		return "", errGatewayFailed("")
	}
	applyHatchHeaders(req, cookieHeader, "")
	resp, err := client.Do(req)
	if err != nil {
		return "", classifyContextOrNetErr(err)
	}
	raw, err := readBoundedHTTPBody(resp)
	if err != nil {
		return "", err
	}
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return "", errAuthExpired()
	}
	if resp.StatusCode != http.StatusOK {
		return "", errGatewayFailed("换取 Muse 访问凭证失败")
	}
	var payload struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil || strings.TrimSpace(payload.AccessToken) == "" {
		return "", errAuthExpired()
	}
	return strings.TrimSpace(payload.AccessToken), nil
}

func fetchHatchToken(ctx context.Context, client *http.Client, baseURL, cookieHeader, accessToken, vmID string) (string, error) {
	bodyMap := map[string]string{
		"vmAddress": "wss://" + vmID + ".metaaivm.com/",
		"vmName":    vmID,
	}
	reqBytes, _ := json.Marshal(bodyMap)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/api/hatch/token", bytes.NewReader(reqBytes))
	if err != nil {
		return "", errGatewayFailed("")
	}
	applyHatchHeaders(req, cookieHeader, accessToken)
	resp, err := client.Do(req)
	if err != nil {
		return "", classifyContextOrNetErr(err)
	}
	raw, err := readBoundedHTTPBody(resp)
	if err != nil {
		return "", err
	}
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return "", errAuthExpired()
	}
	if resp.StatusCode != http.StatusOK {
		return "", errGatewayFailed("获取 Muse 网关握手令牌失败")
	}
	var payload struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil || strings.TrimSpace(payload.Token) == "" {
		return "", errGatewayFailed("Muse 网关握手令牌为空")
	}
	return strings.TrimSpace(payload.Token), nil
}
