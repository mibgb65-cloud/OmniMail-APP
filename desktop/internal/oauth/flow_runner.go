package oauth

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"golang.org/x/oauth2"

	"omnimail/internal/apperr"
	"omnimail/internal/security"
)

func (m *Manager) StartFlow(
	provider, customClientID string,
	onComplete func(res CompletedOAuth, err error),
) (FlowStartResult, error) {
	clientID := ResolveClientID(provider, customClientID)
	if clientID == "" {
		return FlowStartResult{}, apperr.New(
			apperr.CodeInvalidInput,
			"当前开源构建未预置 OAuth Client ID，可在设置中填入自建 Client ID，或改用「16 位应用专用密码」直接连接",
		)
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return FlowStartResult{}, err
	}
	port := ln.Addr().(*net.TCPAddr).Port
	redirectURI := fmt.Sprintf("http://127.0.0.1:%d/oauth/callback", port)
	oauthCfg, err := buildOAuthConfig(provider, clientID, redirectURI)
	if err != nil {
		_ = ln.Close()
		return FlowStartResult{}, err
	}

	flowID, err := randomHex(12)
	if err != nil {
		_ = ln.Close()
		return FlowStartResult{}, err
	}
	state, err := randomHex(32)
	if err != nil {
		_ = ln.Close()
		return FlowStartResult{}, err
	}
	verifier := oauth2.GenerateVerifier()
	authURL := oauthCfg.AuthCodeURL(
		state,
		oauth2.AccessTypeOffline,
		oauth2.S256ChallengeOption(verifier),
		oauth2.SetAuthURLParam("prompt", "consent"),
	)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	mux := http.NewServeMux()
	srv := &http.Server{Handler: mux, ReadHeaderTimeout: 10 * time.Second}
	pf := &pendingFlow{id: flowID, server: srv, listener: ln, cancel: cancel}

	m.mu.Lock()
	m.flows[flowID] = pf
	m.mu.Unlock()

	mux.HandleFunc("/oauth/callback", func(w http.ResponseWriter, r *http.Request) {
		defer m.CancelFlow(flowID)
		q := r.URL.Query()
		if q.Get("state") != state {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(callbackHTML(false, "安全校验参数 state 不匹配，已中止本次授权。")))
			onComplete(CompletedOAuth{FlowID: flowID, Provider: provider}, apperr.New(apperr.CodeAuthExpired, "OAuth state 校验不匹配"))
			return
		}
		if errParam := q.Get("error"); errParam != "" {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write([]byte(callbackHTML(false, "您已取消或未完成浏览器授权。")))
			onComplete(CompletedOAuth{FlowID: flowID, Provider: provider}, apperr.New(apperr.CodeAuthExpired, "浏览器授权未完成: "+errParam))
			return
		}
		code := strings.TrimSpace(q.Get("code"))
		exCtx, exCancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer exCancel()
		tok, exErr := oauthCfg.Exchange(exCtx, code, oauth2.VerifierOption(verifier))
		if exErr != nil {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write([]byte(callbackHTML(false, "换取访问令牌失败，请返回客户端重试。")))
			onComplete(CompletedOAuth{FlowID: flowID, Provider: provider}, apperr.New(apperr.CodeAuthExpired, security.RedactSensitive(exErr.Error())))
			return
		}
		var email, disp string
		if idTok, ok := tok.Extra("id_token").(string); ok {
			email, disp = parseIDTokenClaims(idTok)
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(callbackHTML(true, "您可以直接关闭此浏览器标签页并回到 OmniMail。")))
		go onComplete(CompletedOAuth{
			FlowID: flowID, Provider: provider, Email: email, DisplayName: disp,
			Token: StoredToken{
				Provider: provider, ClientID: clientID, AccessToken: tok.AccessToken,
				RefreshToken: tok.RefreshToken, ExpiryUnixMs: tok.Expiry.UnixMilli(),
			},
		}, nil)
	})

	go func() {
		<-ctx.Done()
		_ = m.CancelFlow(flowID)
	}()
	go func() {
		_ = srv.Serve(ln)
	}()

	return FlowStartResult{
		FlowID:    flowID,
		AuthURL:   authURL,
		ExpiresAt: time.Now().Add(5 * time.Minute).UnixMilli(),
	}, nil
}

func (m *Manager) CancelFlow(flowID string) error {
	m.mu.Lock()
	pf, ok := m.flows[flowID]
	if ok {
		delete(m.flows, flowID)
	}
	m.mu.Unlock()
	if !ok {
		return nil
	}
	pf.cancel()
	_ = pf.listener.Close()
	_ = pf.server.Close()
	return nil
}
