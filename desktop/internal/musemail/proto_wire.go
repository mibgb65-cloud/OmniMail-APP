package musemail

import (
	"fmt"

	"google.golang.org/protobuf/encoding/protowire"
)

type transportFrame struct {
	ChunkID     int64
	ChunkIndex  uint32
	TotalChunks uint32
	Payload     []byte
}

type headerKV struct {
	Key   string
	Value string
}

type appRequestMsg struct {
	Verb    string
	Path    string
	Headers []headerKV
	Body    []byte
	EndBody bool
}

type appResponseMsg struct {
	Status  int32
	Headers []headerKV
	Body    []byte
	EndBody bool
}

type bodyChunkMsg struct {
	Data    []byte
	EndBody bool
}

type resetMsg struct {
	Code   int32
	Reason string
}

type serviceFrameMsg struct {
	StreamID  int64
	Request   *appRequestMsg
	Response  *appResponseMsg
	BodyChunk *bodyChunkMsg
	Reset     *resetMsg
}

func encodeTransportFrame(f transportFrame) []byte {
	var b []byte
	if f.ChunkID != 0 {
		b = protowire.AppendTag(b, 1, protowire.VarintType)
		b = protowire.AppendVarint(b, uint64(f.ChunkID))
	}
	if f.ChunkIndex != 0 {
		b = protowire.AppendTag(b, 2, protowire.VarintType)
		b = protowire.AppendVarint(b, uint64(f.ChunkIndex))
	}
	if f.TotalChunks != 0 {
		b = protowire.AppendTag(b, 3, protowire.VarintType)
		b = protowire.AppendVarint(b, uint64(f.TotalChunks))
	}
	if len(f.Payload) > 0 {
		b = protowire.AppendTag(b, 4, protowire.BytesType)
		b = protowire.AppendBytes(b, f.Payload)
	}
	return b
}

func decodeTransportFrame(raw []byte) (transportFrame, error) {
	var out transportFrame
	for len(raw) > 0 {
		num, typ, n := protowire.ConsumeTag(raw)
		if n < 0 {
			return out, fmt.Errorf("bad transport tag")
		}
		raw = raw[n:]
		switch {
		case num == 1 && typ == protowire.VarintType:
			v, m := protowire.ConsumeVarint(raw)
			if m < 0 {
				return out, fmt.Errorf("bad chunk_id")
			}
			out.ChunkID, raw = int64(v), raw[m:]
		case num == 2 && typ == protowire.VarintType:
			v, m := protowire.ConsumeVarint(raw)
			if m < 0 {
				return out, fmt.Errorf("bad chunk_index")
			}
			out.ChunkIndex, raw = uint32(v), raw[m:]
		case num == 3 && typ == protowire.VarintType:
			v, m := protowire.ConsumeVarint(raw)
			if m < 0 {
				return out, fmt.Errorf("bad total_chunks")
			}
			out.TotalChunks, raw = uint32(v), raw[m:]
		case num == 4 && typ == protowire.BytesType:
			v, m := protowire.ConsumeBytes(raw)
			if m < 0 {
				return out, fmt.Errorf("bad payload")
			}
			out.Payload = append([]byte(nil), v...)
			raw = raw[m:]
		default:
			m := protowire.ConsumeFieldValue(num, typ, raw)
			if m < 0 {
				return out, fmt.Errorf("skip field failed")
			}
			raw = raw[m:]
		}
	}
	return out, nil
}

func encodeServiceRequest(serviceID int32, frameBytes []byte) []byte {
	var b []byte
	if serviceID != 0 {
		b = protowire.AppendTag(b, 1, protowire.VarintType)
		b = protowire.AppendVarint(b, uint64(serviceID))
	}
	if len(frameBytes) > 0 {
		b = protowire.AppendTag(b, 2, protowire.BytesType)
		b = protowire.AppendBytes(b, frameBytes)
	}
	return b
}

func encodeServiceResponse(frameBytes []byte) []byte {
	var b []byte
	if len(frameBytes) > 0 {
		b = protowire.AppendTag(b, 1, protowire.BytesType)
		b = protowire.AppendBytes(b, frameBytes)
	}
	return b
}

func decodeServiceResponsePayload(raw []byte) ([]byte, error) {
	var payload []byte
	for len(raw) > 0 {
		num, typ, n := protowire.ConsumeTag(raw)
		if n < 0 {
			return nil, fmt.Errorf("bad service_response tag")
		}
		raw = raw[n:]
		if num == 1 && typ == protowire.BytesType {
			v, m := protowire.ConsumeBytes(raw)
			if m < 0 {
				return nil, fmt.Errorf("bad service_response payload")
			}
			payload = append([]byte(nil), v...)
			raw = raw[m:]
			continue
		}
		m := protowire.ConsumeFieldValue(num, typ, raw)
		if m < 0 {
			return nil, fmt.Errorf("skip service_response field")
		}
		raw = raw[m:]
	}
	return payload, nil
}
