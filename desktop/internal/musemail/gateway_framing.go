package musemail

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/coder/websocket"
)

type chunkAccumulator struct {
	total uint32
	bytes int
	parts map[uint32][]byte
}

func (s *noiseGatewaySession) readNextServiceFrameLocked(ctx context.Context, stage string) (serviceFrameMsg, error) {
	for {
		typ, ct, err := s.ws.Read(ctx)
		if err != nil {
			return serviceFrameMsg{}, classifyStageNetErr(stage, err)
		}
		if typ != websocket.MessageBinary || len(ct) > maxSingleWSFrameBytes {
			return serviceFrameMsg{}, errStageGatewayFailed(stage, "网关分帧格式或大小超出安全上限")
		}
		pt, err := s.recvCS.Decrypt(nil, nil, ct)
		if err != nil {
			return serviceFrameMsg{}, errStageGatewayFailed(stage, "网关加密帧解密校验失败")
		}
		ntf, err := decodeTransportFrame(pt)
		if err != nil {
			return serviceFrameMsg{}, errStageGatewayFailed(stage, "网关传输层分帧解析失败")
		}
		joined, ready, err := s.reassembleTransportLocked(stage, ntf)
		if err != nil {
			return serviceFrameMsg{}, err
		}
		if !ready {
			continue
		}
		srPayload, err := decodeServiceResponsePayload(joined)
		if err != nil {
			return serviceFrameMsg{}, errStageGatewayFailed(stage, "网关服务响应包解析失败")
		}
		sf, err := decodeServiceFrame(srPayload)
		if err != nil {
			return serviceFrameMsg{}, errStageGatewayFailed(stage, "网关业务流帧解析失败")
		}
		return sf, nil
	}
}

func (s *noiseGatewaySession) reassembleTransportLocked(stage string, ntf transportFrame) ([]byte, bool, error) {
	total := ntf.TotalChunks
	if total == 0 {
		total = 1
	}
	if total > maxChunksPerGroup || ntf.ChunkIndex >= total || len(ntf.Payload) > maxSingleWSFrameBytes {
		return nil, false, errStageGatewayFailed(stage, "网关分片索引或总数超出安全上限")
	}
	if total == 1 {
		return ntf.Payload, true, nil
	}
	acc, exists := s.chunks[ntf.ChunkID]
	if !exists {
		if len(s.chunks) >= maxIncompleteGroups {
			return nil, false, errStageGatewayFailed(stage, "网关并发未完成分片组超出安全上限")
		}
		acc = &chunkAccumulator{total: total, parts: make(map[uint32][]byte, int(total))}
		s.chunks[ntf.ChunkID] = acc
	} else if acc.total != total {
		return nil, false, errStageGatewayFailed(stage, "网关分片组总数不一致")
	}
	if old, dup := acc.parts[ntf.ChunkIndex]; dup {
		acc.bytes -= len(old)
	}
	if acc.bytes+len(ntf.Payload) > maxEnvelopeBytes {
		delete(s.chunks, ntf.ChunkID)
		return nil, false, errStageGatewayFailed(stage, "网关分片聚合大小超出安全上限")
	}
	acc.parts[ntf.ChunkIndex] = ntf.Payload
	acc.bytes += len(ntf.Payload)
	if uint32(len(acc.parts)) < total {
		return nil, false, nil
	}
	delete(s.chunks, ntf.ChunkID)
	out := make([]byte, 0, acc.bytes)
	for idx := uint32(0); idx < total; idx++ {
		part, ok := acc.parts[idx]
		if !ok {
			return nil, false, errStageGatewayFailed(stage, "网关分片组缺失分片")
		}
		out = append(out, part...)
	}
	return out, true, nil
}

func appendBounded(stage string, buf *bytes.Buffer, chunk []byte) error {
	if len(chunk) == 0 {
		return nil
	}
	if buf.Len()+len(chunk) > maxCumulativeBodySize {
		return errStageGatewayFailed(stage, "Muse 邮件响应数据超出安全上限")
	}
	_, _ = buf.Write(chunk)
	return nil
}

func inspectGatewayStatusAndJSON(stage string, status int32, body []byte) ([]byte, error) {
	if status == http.StatusUnauthorized {
		return nil, errStageAuthExpired(stage, int(status))
	}
	if status == http.StatusForbidden {
		if isEmailNotEnabledBody(body) {
			return nil, errEmailNotEnabled()
		}
		return nil, errStageAuthExpired(stage, int(status))
	}
	if status < 200 || status >= 300 {
		if isEmailNotEnabledBody(body) {
			return nil, errEmailNotEnabled()
		}
		return nil, errStageGatewayFailed(stage, fmt.Sprintf("Muse 邮件服务返回异常状态（HTTP %d）", status))
	}
	if len(bytes.TrimSpace(body)) == 0 {
		return []byte("{}"), nil
	}
	var probe map[string]any
	if err := json.Unmarshal(body, &probe); err != nil {
		return nil, errStageGatewayFailed(stage, "Muse 邮件服务返回非预期数据格式")
	}
	if okVal, hasOK := probe["ok"].(bool); hasOK && !okVal {
		if isEmailNotEnabledMap(probe) {
			return nil, errEmailNotEnabled()
		}
		return nil, errStageGatewayFailed(stage, "Muse 邮件服务调用失败")
	}
	if resRaw, hasRes := probe["result"]; hasRes && resRaw != nil {
		if unwrapped, err := json.Marshal(resRaw); err == nil {
			return unwrapped, nil
		}
	}
	return body, nil
}
