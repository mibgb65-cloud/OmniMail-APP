package musemail

import (
	"bytes"
	"encoding/json"
	"strings"
)

func decodeJSONUseNumber(raw []byte, dst any) error {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	return dec.Decode(dst)
}

func parseThreadListPayload(raw []byte) ([]ThreadSummaryDTO, string, error) {
	var root map[string]any
	if err := decodeJSONUseNumber(raw, &root); err != nil {
		return nil, "", errGatewayFailed("解析 Muse 会话列表失败")
	}
	items, _ := root["data"].([]any)
	if len(items) == 0 {
		if alt, ok := root["threads"].([]any); ok {
			items = alt
		}
	}
	out := make([]ThreadSummaryDTO, 0, len(items))
	for _, it := range items {
		m, ok := it.(map[string]any)
		if !ok {
			continue
		}
		id := strings.TrimSpace(asString(m["id"]))
		if id == "" || len(id) > maxThreadIDLen {
			continue
		}
		last, _ := m["last_message"].(map[string]any)
		ts, known := parseServerTimestamp(firstNonNil(last["created_at"], m["updated_at"], m["created_at"]))
		msgCount := asPositiveInt(m["message_count"])
		if msgCount <= 0 {
			msgCount = 1
		}
		out = append(out, ThreadSummaryDTO{
			ID:           id,
			Subject:      clampRunes(strings.TrimSpace(asString(m["subject"])), maxSubjectRunes),
			MessageCount: msgCount,
			Participants: extractStringList(m["participants"], maxParticipants),
			LastFrom:     clampRunes(strings.TrimSpace(asString(last["header_from"])), 254),
			LastFromName: clampRunes(strings.TrimSpace(asString(last["header_from_name"])), 160),
			Preview:      clampRunes(strings.TrimSpace(firstNonEmpty(asString(last["preview"]), asString(m["preview"]))), maxPreviewRunes),
			CreatedAtMs:  ts,
			TimeKnown:    known,
		})
		if len(out) >= 100 {
			break
		}
	}
	nextCursor := ""
	if paging, ok := root["paging"].(map[string]any); ok {
		if cursors, ok := paging["cursors"].(map[string]any); ok {
			nextCursor = strings.TrimSpace(asString(cursors["after"]))
		}
	}
	if len(nextCursor) > maxUpstreamCursor {
		nextCursor = ""
	}
	return out, nextCursor, nil
}

func parseThreadDetailPayload(threadID, boundEmail string, raw []byte) (ThreadDetailDTO, error) {
	var root map[string]any
	if err := decodeJSONUseNumber(raw, &root); err != nil {
		return ThreadDetailDTO{}, errGatewayFailed("解析 Muse 会话详情失败")
	}
	rawMsgs, _ := root["messages"].([]any)
	msgs := make([]MessageDTO, 0, len(rawMsgs))
	subjectFallback := clampRunes(strings.TrimSpace(asString(root["subject"])), maxSubjectRunes)

	for i, item := range rawMsgs {
		if len(msgs) >= maxMessagesPerThd {
			break
		}
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		msg := normalizeSingleMessage(threadID, boundEmail, i, m)
		if subjectFallback == "" && msg.Subject != "" {
			subjectFallback = msg.Subject
		}
		msgs = append(msgs, msg)
	}

	return ThreadDetailDTO{
		ID:       threadID,
		Subject:  subjectFallback,
		Email:    boundEmail,
		Messages: msgs,
	}, nil
}

func normalizeSingleMessage(threadID, boundEmail string, idx int, m map[string]any) MessageDTO {
	id := strings.TrimSpace(asString(m["id"]))
	if id == "" || len(id) > maxThreadIDLen {
		id = threadID + "#" + string(rune('1'+idx%9))
	}
	fromAddr := clampRunes(strings.TrimSpace(asString(m["header_from"])), 254)
	fromName := clampRunes(strings.TrimSpace(asString(m["header_from_name"])), 160)
	dir := normalizeDirection(asString(m["direction"]), fromAddr, boundEmail)
	ts, known := parseServerTimestamp(m["created_at"])
	bodyText := clampRunes(firstNonEmpty(
		asString(m["text_body"]),
		asString(m["extracted_text"]),
		asString(m["preview"]),
	), maxBodyRunes)

	verdict := ""
	if authObj, ok := m["sender_authentication"].(map[string]any); ok {
		verdict = clampRunes(strings.TrimSpace(asString(authObj["verdict"])), 64)
	}

	return MessageDTO{
		ID:              id,
		ThreadID:        threadID,
		Direction:       dir,
		From:            fromAddr,
		FromName:        fromName,
		To:              extractStringList(m["header_to"], maxParticipants),
		Cc:              extractStringList(m["header_cc"], maxParticipants),
		Subject:         clampRunes(strings.TrimSpace(asString(m["subject"])), maxSubjectRunes),
		CreatedAtMs:     ts,
		TimeKnown:       known,
		BodyText:        bodyText,
		MuseAuthVerdict: verdict,
		Attachments:     normalizeAttachments(m["attachments"]),
	}
}
