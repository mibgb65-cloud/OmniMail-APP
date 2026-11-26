package musemail

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"net/http"

	"github.com/coder/websocket"
)

func (s *noiseGatewaySession) Close() error {
	s.mu.Lock()
	s.closed = true
	s.chunks = nil
	ws := s.ws
	s.mu.Unlock()
	if ws != nil {
		return ws.CloseNow()
	}
	return nil
}

func (s *noiseGatewaySession) GetMailboxEmail(ctx context.Context) (string, error) {
	raw, err := s.unaryGET(ctx, routeMailboxGet, "", nil)
	if err != nil {
		return "", err
	}
	email, err := parseVerifiedMailboxEmail(raw)
	if err != nil {
		return "", classifyStageNetErr(stageMailboxGet, err)
	}
	return email, nil
}

func (s *noiseGatewaySession) ListThreadsRaw(ctx context.Context, upstreamCursor string) ([]byte, error) {
	var q map[string]string
	if upstreamCursor != "" {
		q = map[string]string{"cursor": upstreamCursor}
	}
	return s.unaryGET(ctx, routeThreadsList, "", q)
}

func (s *noiseGatewaySession) GetThreadRaw(ctx context.Context, threadID string) ([]byte, error) {
	return s.unaryGET(ctx, routeThreadsGet, threadID, nil)
}

func (s *noiseGatewaySession) unaryGET(ctx context.Context, routeName, pathParam string, query map[string]string) ([]byte, error) {
	stage := stageForRoute(routeName)
	path, err := buildReadOnlyPath(routeName, pathParam, query)
	if err != nil {
		return nil, err
	}

	reqCtx, cancel := context.WithTimeout(ctx, defaultRequestTimeout)
	defer cancel()

	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed || s.ws == nil {
		return nil, errStageGatewayFailed(stage, "Muse 网关连接已关闭")
	}

	sid := s.stream
	s.stream++
	if err := s.sendGetFrameLocked(reqCtx, stage, sid, path); err != nil {
		_ = s.ws.CloseNow()
		s.closed = true
		return nil, err
	}

	status, body, err := s.readStreamResponseLocked(reqCtx, stage, sid)
	if err != nil {
		_ = s.ws.CloseNow()
		s.closed = true
		return nil, err
	}
	return inspectGatewayStatusAndJSON(stage, status, body)
}

func (s *noiseGatewaySession) sendGetFrameLocked(ctx context.Context, stage string, sid int64, path string) error {
	sfBytes := encodeServiceFrameRequest(sid, appRequestMsg{
		Verb:    http.MethodGet,
		Path:    path,
		Headers: []headerKV{{Key: "x-request-id", Value: randomRequestID()}},
		EndBody: true,
	})
	outer := encodeServiceRequest(0, sfBytes)
	ntf := encodeTransportFrame(transportFrame{
		ChunkID:     randomChunkID(),
		ChunkIndex:  0,
		TotalChunks: 1,
		Payload:     outer,
	})
	ct, err := s.sendCS.Encrypt(nil, nil, ntf)
	if err != nil {
		return errStageGatewayFailed(stage, "网关请求加密失败")
	}
	if err := s.ws.Write(ctx, websocket.MessageBinary, ct); err != nil {
		return classifyStageNetErr(stage, err)
	}
	return nil
}

func (s *noiseGatewaySession) readStreamResponseLocked(ctx context.Context, stage string, sid int64) (int32, []byte, error) {
	var (
		gotStatus bool
		status    int32
		done      bool
		bodyBuf   bytes.Buffer
	)
	for !done {
		sf, err := s.readNextServiceFrameLocked(ctx, stage)
		if err != nil {
			return 0, nil, err
		}
		if sf.StreamID != sid {
			continue
		}
		switch {
		case sf.Reset != nil:
			return 0, nil, errStageGatewayFailed(stage, "Muse 网关重置了当前请求流")
		case sf.Response != nil:
			gotStatus = true
			status = sf.Response.Status
			if err := appendBounded(stage, &bodyBuf, sf.Response.Body); err != nil {
				return 0, nil, err
			}
			done = sf.Response.EndBody
		case sf.BodyChunk != nil && gotStatus:
			if err := appendBounded(stage, &bodyBuf, sf.BodyChunk.Data); err != nil {
				return 0, nil, err
			}
			done = sf.BodyChunk.EndBody
		}
	}
	if !gotStatus {
		return 0, nil, errStageGatewayFailed(stage, "Muse 网关未返回有效响应头")
	}
	return status, bodyBuf.Bytes(), nil
}

func randomRequestID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%s-%s-%s-%s-%s",
		hex.EncodeToString(b[0:4]),
		hex.EncodeToString(b[4:6]),
		hex.EncodeToString(b[6:8]),
		hex.EncodeToString(b[8:10]),
		hex.EncodeToString(b[10:16]),
	)
}

func randomChunkID() int64 {
	var b [8]byte
	_, _ = rand.Read(b[:])
	if v := int64(binary.LittleEndian.Uint64(b[:])); v != 0 {
		return v
	}
	return 1
}
