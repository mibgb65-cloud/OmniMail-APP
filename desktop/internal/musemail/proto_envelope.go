package musemail

import (
	"fmt"

	"google.golang.org/protobuf/encoding/protowire"
)

func encodeHeaderKV(h headerKV) []byte {
	var b []byte
	if h.Key != "" {
		b = protowire.AppendTag(b, 1, protowire.BytesType)
		b = protowire.AppendString(b, h.Key)
	}
	if h.Value != "" {
		b = protowire.AppendTag(b, 2, protowire.BytesType)
		b = protowire.AppendString(b, h.Value)
	}
	return b
}

func encodeServiceFrameRequest(streamID int64, req appRequestMsg) []byte {
	var rb []byte
	if req.Verb != "" {
		rb = protowire.AppendTag(rb, 1, protowire.BytesType)
		rb = protowire.AppendString(rb, req.Verb)
	}
	if req.Path != "" {
		rb = protowire.AppendTag(rb, 2, protowire.BytesType)
		rb = protowire.AppendString(rb, req.Path)
	}
	for _, h := range req.Headers {
		rb = protowire.AppendTag(rb, 3, protowire.BytesType)
		rb = protowire.AppendBytes(rb, encodeHeaderKV(h))
	}
	if len(req.Body) > 0 {
		rb = protowire.AppendTag(rb, 4, protowire.BytesType)
		rb = protowire.AppendBytes(rb, req.Body)
	}
	if req.EndBody {
		rb = protowire.AppendTag(rb, 5, protowire.VarintType)
		rb = protowire.AppendVarint(rb, 1)
	}

	var fb []byte
	if streamID != 0 {
		fb = protowire.AppendTag(fb, 1, protowire.VarintType)
		fb = protowire.AppendVarint(fb, uint64(streamID))
	}
	fb = protowire.AppendTag(fb, 2, protowire.BytesType)
	fb = protowire.AppendBytes(fb, rb)
	return fb
}

func decodeServiceFrame(raw []byte) (serviceFrameMsg, error) {
	var out serviceFrameMsg
	for len(raw) > 0 {
		num, typ, n := protowire.ConsumeTag(raw)
		if n < 0 {
			return out, fmt.Errorf("bad service_frame tag")
		}
		raw = raw[n:]
		switch {
		case num == 1 && typ == protowire.VarintType:
			v, m := protowire.ConsumeVarint(raw)
			if m < 0 {
				return out, fmt.Errorf("bad stream_id")
			}
			out.StreamID, raw = int64(v), raw[m:]
		case num == 2 && typ == protowire.BytesType:
			v, m := protowire.ConsumeBytes(raw)
			if m < 0 {
				return out, fmt.Errorf("bad request bytes")
			}
			req, err := decodeAppRequest(v)
			if err != nil {
				return out, err
			}
			out.Request = &req
			out.Response, out.BodyChunk, out.Reset = nil, nil, nil
			raw = raw[m:]
		case num == 3 && typ == protowire.BytesType:
			v, m := protowire.ConsumeBytes(raw)
			if m < 0 {
				return out, fmt.Errorf("bad response bytes")
			}
			resp, err := decodeAppResponse(v)
			if err != nil {
				return out, err
			}
			out.Response = &resp
			out.Request, out.BodyChunk, out.Reset = nil, nil, nil
			raw = raw[m:]
		case num == 4 && typ == protowire.BytesType:
			v, m := protowire.ConsumeBytes(raw)
			if m < 0 {
				return out, fmt.Errorf("bad body_chunk bytes")
			}
			chunk, err := decodeBodyChunk(v)
			if err != nil {
				return out, err
			}
			out.BodyChunk = &chunk
			out.Request, out.Response, out.Reset = nil, nil, nil
			raw = raw[m:]
		case num == 5 && typ == protowire.BytesType:
			v, m := protowire.ConsumeBytes(raw)
			if m < 0 {
				return out, fmt.Errorf("bad reset bytes")
			}
			rst, err := decodeReset(v)
			if err != nil {
				return out, err
			}
			out.Reset = &rst
			out.Request, out.Response, out.BodyChunk = nil, nil, nil
			raw = raw[m:]
		default:
			m := protowire.ConsumeFieldValue(num, typ, raw)
			if m < 0 {
				return out, fmt.Errorf("skip service_frame field")
			}
			raw = raw[m:]
		}
	}
	return out, nil
}
