package musemail

import (
	"fmt"

	"google.golang.org/protobuf/encoding/protowire"
)

func consumeStrField(raw []byte) (string, []byte, error) {
	v, m := protowire.ConsumeString(raw)
	if m < 0 {
		return "", nil, fmt.Errorf("bad string field")
	}
	return v, raw[m:], nil
}

func consumeBytesField(raw []byte) ([]byte, []byte, error) {
	v, m := protowire.ConsumeBytes(raw)
	if m < 0 {
		return nil, nil, fmt.Errorf("bad bytes field")
	}
	return append([]byte(nil), v...), raw[m:], nil
}

func consumeVarintField(raw []byte) (uint64, []byte, error) {
	v, m := protowire.ConsumeVarint(raw)
	if m < 0 {
		return 0, nil, fmt.Errorf("bad varint field")
	}
	return v, raw[m:], nil
}

func skipUnknownField(num protowire.Number, typ protowire.Type, raw []byte) ([]byte, error) {
	if m := protowire.ConsumeFieldValue(num, typ, raw); m >= 0 {
		return raw[m:], nil
	}
	return nil, fmt.Errorf("skip field failed")
}

func consumeHeaderElem(raw []byte, dst *[]headerKV) ([]byte, error) {
	hb, rest, err := consumeBytesField(raw)
	if err != nil {
		return nil, err
	}
	hdr, err := decodeHeaderKV(hb)
	if err != nil {
		return nil, err
	}
	*dst = append(*dst, hdr)
	return rest, nil
}

func decodeHeaderKV(raw []byte) (headerKV, error) {
	var out headerKV
	var err error
	for len(raw) > 0 {
		num, typ, n := protowire.ConsumeTag(raw)
		if n < 0 {
			return out, fmt.Errorf("bad header tag")
		}
		raw = raw[n:]
		switch {
		case num == 1 && typ == protowire.BytesType:
			out.Key, raw, err = consumeStrField(raw)
		case num == 2 && typ == protowire.BytesType:
			out.Value, raw, err = consumeStrField(raw)
		default:
			raw, err = skipUnknownField(num, typ, raw)
		}
		if err != nil {
			return out, err
		}
	}
	return out, nil
}

func decodeAppRequest(raw []byte) (appRequestMsg, error) {
	var out appRequestMsg
	for len(raw) > 0 {
		num, typ, n := protowire.ConsumeTag(raw)
		if n < 0 {
			return out, fmt.Errorf("bad req tag")
		}
		raw = raw[n:]
		var err error
		switch {
		case num == 1 && typ == protowire.BytesType:
			out.Verb, raw, err = consumeStrField(raw)
		case num == 2 && typ == protowire.BytesType:
			out.Path, raw, err = consumeStrField(raw)
		case num == 3 && typ == protowire.BytesType:
			raw, err = consumeHeaderElem(raw, &out.Headers)
		case num == 4 && typ == protowire.BytesType:
			out.Body, raw, err = consumeBytesField(raw)
		case num == 5 && typ == protowire.VarintType:
			var v uint64
			v, raw, err = consumeVarintField(raw)
			out.EndBody = v != 0
		default:
			raw, err = skipUnknownField(num, typ, raw)
		}
		if err != nil {
			return out, err
		}
	}
	return out, nil
}

func decodeAppResponse(raw []byte) (appResponseMsg, error) {
	var out appResponseMsg
	for len(raw) > 0 {
		num, typ, n := protowire.ConsumeTag(raw)
		if n < 0 {
			return out, fmt.Errorf("bad resp tag")
		}
		raw = raw[n:]
		var err error
		switch {
		case num == 1 && typ == protowire.VarintType:
			var v uint64
			v, raw, err = consumeVarintField(raw)
			out.Status = int32(v)
		case num == 2 && typ == protowire.BytesType:
			raw, err = consumeHeaderElem(raw, &out.Headers)
		case num == 3 && typ == protowire.BytesType:
			out.Body, raw, err = consumeBytesField(raw)
		case num == 4 && typ == protowire.VarintType:
			var v uint64
			v, raw, err = consumeVarintField(raw)
			out.EndBody = v != 0
		default:
			raw, err = skipUnknownField(num, typ, raw)
		}
		if err != nil {
			return out, err
		}
	}
	return out, nil
}

func decodeBodyChunk(raw []byte) (bodyChunkMsg, error) {
	var out bodyChunkMsg
	for len(raw) > 0 {
		num, typ, n := protowire.ConsumeTag(raw)
		if n < 0 {
			return out, fmt.Errorf("bad chunk tag")
		}
		raw = raw[n:]
		var err error
		switch {
		case num == 1 && typ == protowire.BytesType:
			out.Data, raw, err = consumeBytesField(raw)
		case num == 2 && typ == protowire.VarintType:
			var v uint64
			v, raw, err = consumeVarintField(raw)
			out.EndBody = v != 0
		default:
			raw, err = skipUnknownField(num, typ, raw)
		}
		if err != nil {
			return out, err
		}
	}
	return out, nil
}

func decodeReset(raw []byte) (resetMsg, error) {
	var out resetMsg
	for len(raw) > 0 {
		num, typ, n := protowire.ConsumeTag(raw)
		if n < 0 {
			return out, fmt.Errorf("bad reset tag")
		}
		raw = raw[n:]
		var err error
		switch {
		case num == 1 && typ == protowire.VarintType:
			var v uint64
			v, raw, err = consumeVarintField(raw)
			out.Code = int32(v)
		case num == 2 && typ == protowire.BytesType:
			out.Reason, raw, err = consumeStrField(raw)
		default:
			raw, err = skipUnknownField(num, typ, raw)
		}
		if err != nil {
			return out, err
		}
	}
	return out, nil
}
