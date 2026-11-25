package musemail

import (
	"context"
	"crypto/rand"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/coder/websocket"
	"github.com/flynn/noise"
	"google.golang.org/protobuf/encoding/protowire"
)

type fakeServerStep func(t *testing.T, ws *websocket.Conn, sendCS *noise.CipherState, sid int64, req appRequestMsg)

type fakeMuseGateway struct {
	srv     *httptest.Server
	wsURL   string
	handler fakeServerStep
}

func startFakeMuseGateway(t *testing.T, handler fakeServerStep) *fakeMuseGateway {
	t.Helper()
	fg := &fakeMuseGateway{handler: handler}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/session", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Sec-Fetch-Site") != "same-origin" || !strings.Contains(r.Header.Get("Cookie"), "hatch_sess=valid_sess") {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":"sensitive_raw_cookie_leak_check"}`))
			return
		}
		_, _ = w.Write([]byte(`{"vm_id":"vm-test-01"}`))
	})
	mux.HandleFunc("/api/auth/check", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.Header.Get("Sec-Fetch-Mode") != "cors" {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		_, _ = w.Write([]byte(`{"access_token":"at_secret_999"}`))
	})
	mux.HandleFunc("/api/hatch/token", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer at_secret_999" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_, _ = w.Write([]byte(`{"token":"ht_secret_888"}`))
	})
	mux.HandleFunc("/v1/noise", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("vm_id") != "vm-test-01" || r.URL.Query().Get("auth_token") != "ht_secret_888" {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		ws, err := websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true})
		if err != nil {
			return
		}
		defer ws.CloseNow()
		fg.serveNoiseLoop(t, r.Context(), ws)
	})
	fg.srv = httptest.NewServer(mux)
	fg.wsURL = "ws" + strings.TrimPrefix(fg.srv.URL, "http") + "/v1/noise"
	t.Cleanup(fg.srv.Close)
	return fg
}

func (fg *fakeMuseGateway) connector() *LiveConnector {
	cli := fg.srv.Client()
	return &LiveConnector{MuseOrigin: fg.srv.URL, GatewayURL: fg.wsURL, HTTPClient: cli, WSDialHTTP: cli}
}

func (fg *fakeMuseGateway) serveNoiseLoop(t *testing.T, ctx context.Context, ws *websocket.Conn) {
	cs := newNoiseCipherSuite()
	kp, _ := cs.GenerateKeypair(rand.Reader)
	hs, _ := noise.NewHandshakeState(noise.Config{
		CipherSuite: cs, Random: rand.Reader, Pattern: noise.HandshakeXX, Initiator: false, StaticKeypair: kp,
	})
	_, msg1, err := ws.Read(ctx)
	if err != nil {
		return
	}
	_, _, _, _ = hs.ReadMessage(nil, msg1)
	msg2, _, _, _ := hs.WriteMessage(nil, nil)
	_ = ws.Write(ctx, websocket.MessageBinary, msg2)
	_, msg3, err := ws.Read(ctx)
	if err != nil {
		return
	}
	_, recvCS, sendCS, err := hs.ReadMessage(nil, msg3)
	if err != nil || recvCS == nil || sendCS == nil {
		return
	}
	for {
		_, ct, err := ws.Read(ctx)
		if err != nil {
			return
		}
		pt, err := recvCS.Decrypt(nil, nil, ct)
		if err != nil {
			return
		}
		ntf, err := decodeTransportFrame(pt)
		if err != nil {
			return
		}
		sf, err := decodeServiceFrame(extractInnerServiceReq(ntf.Payload))
		if err != nil || sf.Request == nil {
			return
		}
		fg.handler(t, ws, sendCS, sf.StreamID, *sf.Request)
	}
}

func extractInnerServiceReq(raw []byte) []byte {
	for len(raw) > 0 {
		num, typ, n := protowire.ConsumeTag(raw)
		if n < 0 {
			return nil
		}
		raw = raw[n:]
		if num == 2 && typ == protowire.BytesType {
			v, _ := protowire.ConsumeBytes(raw)
			return v
		}
		m := protowire.ConsumeFieldValue(num, typ, raw)
		if m < 0 {
			return nil
		}
		raw = raw[m:]
	}
	return nil
}

func encodeTestResponseFrame(sid int64, status int32, body []byte, endBody bool) []byte {
	var rb, fb []byte
	rb = protowire.AppendTag(rb, 1, protowire.VarintType)
	rb = protowire.AppendVarint(rb, uint64(status))
	if len(body) > 0 {
		rb = protowire.AppendTag(rb, 3, protowire.BytesType)
		rb = protowire.AppendBytes(rb, body)
	}
	if endBody {
		rb = protowire.AppendTag(rb, 4, protowire.VarintType)
		rb = protowire.AppendVarint(rb, 1)
	}
	fb = protowire.AppendTag(fb, 1, protowire.VarintType)
	fb = protowire.AppendVarint(fb, uint64(sid))
	fb = protowire.AppendTag(fb, 3, protowire.BytesType)
	fb = protowire.AppendBytes(fb, rb)
	return encodeServiceResponse(fb)
}

func encodeTestBodyChunkFrame(sid int64, chunk []byte, endBody bool) []byte {
	var cb, fb []byte
	if len(chunk) > 0 {
		cb = protowire.AppendTag(cb, 1, protowire.BytesType)
		cb = protowire.AppendBytes(cb, chunk)
	}
	if endBody {
		cb = protowire.AppendTag(cb, 2, protowire.VarintType)
		cb = protowire.AppendVarint(cb, 1)
	}
	fb = protowire.AppendTag(fb, 1, protowire.VarintType)
	fb = protowire.AppendVarint(fb, uint64(sid))
	fb = protowire.AppendTag(fb, 4, protowire.BytesType)
	fb = protowire.AppendBytes(fb, cb)
	return encodeServiceResponse(fb)
}

func sendEncryptedTransport(ws *websocket.Conn, sendCS *noise.CipherState, f transportFrame) {
	if ct, err := sendCS.Encrypt(nil, nil, encodeTransportFrame(f)); err == nil {
		_ = ws.Write(context.Background(), websocket.MessageBinary, ct)
	}
}
