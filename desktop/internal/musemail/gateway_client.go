package musemail

import (
	"context"
	"crypto/rand"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/flynn/noise"
)

const (
	routeMailboxGet  = "email.mailbox.get"
	routeThreadsList = "email.threads.list"
	routeThreadsGet  = "email.threads.get"

	defaultRequestTimeout = 45 * time.Second
	maxSingleWSFrameBytes = 128 * 1024
	maxIncompleteGroups   = 4
	maxChunksPerGroup     = 64
	maxEnvelopeBytes      = 4 * 1024 * 1024
	maxCumulativeBodySize = 4 * 1024 * 1024
)

var allowedReadOnlyRoutes = map[string]string{
	routeMailboxGet:  "/api/email/mailbox",
	routeThreadsList: "/api/email/threads",
	routeThreadsGet:  "/api/email/threads/{thread_id}",
}

// LiveConnector 使用纯 Go HTTPS + WSS + Noise XX 建立只读网关连接。
type LiveConnector struct {
	MuseOrigin string
	GatewayURL string
	HTTPClient *http.Client
	WSDialHTTP *http.Client
}

func NewLiveConnector() *LiveConnector {
	return &LiveConnector{
		MuseOrigin: defaultMuseOrigin,
		GatewayURL: "wss://" + defaultGatewayHost + "/v1/noise",
		HTTPClient: newChromeTLSHTTPClient([]string{"http/1.1", "h2"}),
		WSDialHTTP: newChromeTLSHTTPClient([]string{"http/1.1"}),
	}
}

func (c *LiveConnector) Connect(ctx context.Context, cookieHeader string) (GatewaySession, error) {
	httpCli := c.HTTPClient
	if httpCli == nil {
		httpCli = newChromeTLSHTTPClient([]string{"http/1.1", "h2"})
	}
	tokens, err := exchangeGatewayTokens(ctx, httpCli, c.MuseOrigin, cookieHeader)
	if err != nil {
		return nil, err
	}
	gwBase := c.GatewayURL
	if gwBase == "" {
		gwBase = "wss://" + defaultGatewayHost + "/v1/noise"
	}
	u, err := url.Parse(gwBase)
	if err != nil {
		return nil, errGatewayFailed("网关地址配置异常")
	}
	q := u.Query()
	q.Set("vm_id", tokens.VMID)
	q.Set("auth_token", tokens.HatchToken)
	u.RawQuery = q.Encode()

	dialCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	wsHTTP := c.WSDialHTTP
	if wsHTTP == nil {
		wsHTTP = httpCli
	}
	hdr := http.Header{}
	hdr.Set("User-Agent", museBrowserUA)
	hdr.Set("Origin", defaultMuseOrigin)
	ws, resp, err := websocket.Dial(dialCtx, u.String(), &websocket.DialOptions{
		HTTPClient: wsHTTP,
		HTTPHeader: hdr,
	})
	if err != nil {
		if resp != nil && (resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden) {
			return nil, errAuthExpired()
		}
		return nil, classifyContextOrNetErr(err)
	}
	ws.SetReadLimit(maxSingleWSFrameBytes)

	sendCS, recvCS, err := performNoiseXXInitiator(dialCtx, ws)
	if err != nil {
		_ = ws.CloseNow()
		return nil, err
	}
	return &noiseGatewaySession{
		ws:     ws,
		sendCS: sendCS,
		recvCS: recvCS,
		stream: 1,
		chunks: make(map[int64]*chunkAccumulator),
	}, nil
}

func newNoiseCipherSuite() noise.CipherSuite {
	return noise.NewCipherSuite(noise.DH25519, noise.CipherAESGCM, noise.HashSHA256)
}

func performNoiseXXInitiator(ctx context.Context, ws *websocket.Conn) (*noise.CipherState, *noise.CipherState, error) {
	cs := newNoiseCipherSuite()
	staticKP, err := cs.GenerateKeypair(rand.Reader)
	if err != nil {
		return nil, nil, errGatewayFailed("")
	}
	hs, err := noise.NewHandshakeState(noise.Config{
		CipherSuite:   cs,
		Random:        rand.Reader,
		Pattern:       noise.HandshakeXX,
		Initiator:     true,
		StaticKeypair: staticKP,
	})
	if err != nil {
		return nil, nil, errGatewayFailed("")
	}
	msg1, _, _, err := hs.WriteMessage(nil, nil)
	if err != nil {
		return nil, nil, errGatewayFailed("Noise 握手初始化失败")
	}
	if err := ws.Write(ctx, websocket.MessageBinary, msg1); err != nil {
		return nil, nil, classifyContextOrNetErr(err)
	}
	typ, msg2, err := ws.Read(ctx)
	if err != nil {
		return nil, nil, classifyContextOrNetErr(err)
	}
	if typ != websocket.MessageBinary {
		return nil, nil, errGatewayFailed("网关握手帧类型无效")
	}
	if _, _, _, err := hs.ReadMessage(nil, msg2); err != nil {
		return nil, nil, errGatewayFailed("网关加密握手校验未通过")
	}
	msg3, sendCS, recvCS, err := hs.WriteMessage(nil, nil)
	if err != nil || sendCS == nil || recvCS == nil {
		return nil, nil, errGatewayFailed("网关会话密钥派生失败")
	}
	if err := ws.Write(ctx, websocket.MessageBinary, msg3); err != nil {
		return nil, nil, classifyContextOrNetErr(err)
	}
	return sendCS, recvCS, nil
}

type noiseGatewaySession struct {
	mu     sync.Mutex
	ws     *websocket.Conn
	sendCS *noise.CipherState
	recvCS *noise.CipherState
	stream int64
	chunks map[int64]*chunkAccumulator
	closed bool
}

func buildReadOnlyPath(routeName string, pathParam string, query map[string]string) (string, error) {
	tpl, ok := allowedReadOnlyRoutes[routeName]
	if !ok {
		return "", errUnsupported("禁止调用非白名单 Muse 路由")
	}
	path := tpl
	if strings.Contains(path, "{thread_id}") {
		if strings.TrimSpace(pathParam) == "" {
			return "", errGatewayFailed("会话标识不能为空")
		}
		path = strings.ReplaceAll(path, "{thread_id}", url.PathEscape(strings.TrimSpace(pathParam)))
	}
	if len(query) > 0 {
		vals := url.Values{}
		for k, v := range query {
			if v != "" {
				vals.Set(k, v)
			}
		}
		if enc := vals.Encode(); enc != "" {
			path += "?" + enc
		}
	}
	return path, nil
}
