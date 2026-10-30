package mailnet

import (
	"sort"

	"omnimail/desktop/internal/domain"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"
)

const (
	headerEnvelope = 1 << iota
	headerFlags
	headerDate
	headerSize
	allHeaderFields = headerEnvelope | headerFlags | headerDate | headerSize
)

type headerData struct {
	value imapclient.FetchMessageBuffer
	seen  int
}

func (h *headerData) complete() bool {
	return h.seen == allHeaderFields && h.value.Envelope != nil
}

func (h *headerData) take(item imapclient.FetchItemData) {
	switch item := item.(type) {
	case imapclient.FetchItemDataUID:
		h.value.UID = item.UID
	case imapclient.FetchItemDataEnvelope:
		h.value.Envelope, h.seen = item.Envelope, h.seen|headerEnvelope
	case imapclient.FetchItemDataFlags:
		h.value.Flags, h.seen = item.Flags, h.seen|headerFlags
	case imapclient.FetchItemDataInternalDate:
		h.value.InternalDate, h.seen = item.Time, h.seen|headerDate
	case imapclient.FetchItemDataRFC822Size:
		h.value.RFC822Size, h.seen = item.Size, h.seen|headerSize
	}
}

func (h *headerData) merge(extra *headerData) {
	if extra.seen&headerEnvelope != 0 {
		h.value.Envelope = extra.value.Envelope
	}
	if extra.seen&headerFlags != 0 {
		h.value.Flags = extra.value.Flags
	}
	if extra.seen&headerDate != 0 {
		h.value.InternalDate = extra.value.InternalDate
	}
	if extra.seen&headerSize != 0 {
		h.value.RFC822Size = extra.value.RFC822Size
	}
	h.seen |= extra.seen
}

func (s *session) fetchHeaderData(set imap.UIDSet, options *imap.FetchOptions) (map[imap.UID]*headerData, error) {
	command := s.client.Fetch(set, options)
	result := make(map[imap.UID]*headerData)
	for message := command.Next(); message != nil; message = command.Next() {
		header := new(headerData)
		for item := message.Next(); item != nil; item = message.Next() {
			if body, ok := item.(imapclient.FetchItemDataBodySection); ok {
				envelope, err := s.readHeaderLiteral(body)
				if err != nil {
					s.abortFetch(command)
					return nil, err
				}
				header.value.Envelope = envelope
				header.seen |= headerEnvelope
				continue
			}
			header.take(item)
		}
		if header.value.UID == 0 || !set.Contains(header.value.UID) {
			s.abortFetch(command)
			return nil, &protocolFailure{reason: "uid_out_of_range"}
		}
		if len(result) >= 100 {
			s.abortFetch(command)
			return nil, &protocolFailure{reason: "batch_overflow"}
		}
		result[header.value.UID] = header
	}
	if err := command.Close(); err != nil {
		return nil, s.commandError(err)
	}
	return result, nil
}

func (s *session) Headers(start, end uint32) ([]domain.RemoteMessage, error) {
	if start == 0 || end < start || end-start >= 100 {
		return nil, domain.ErrProtocol
	}
	var set, missing imap.UIDSet
	set.AddRange(imap.UID(start), imap.UID(end))
	section := &imap.FetchItemBodySection{Specifier: imap.PartSpecifierHeader, Peek: true}
	headers, err := s.fetchHeaderData(set, &imap.FetchOptions{
		UID: true, Flags: true, InternalDate: true, RFC822Size: true,
		BodySection: []*imap.FetchItemBodySection{section},
	})
	if err != nil {
		return nil, err
	}
	for uid, header := range headers {
		if !header.complete() {
			missing.AddNum(uid)
		}
	}
	if len(missing) > 0 {
		// 部分服务器先返回 UID/FLAGS；当前协议库按 UID 去重，后续同 UID 的元数据可能不在命令结果中。
		// 只补取一次不含 FLAGS 的元数据，再严格合并；不能把缺失项当作已删除而清理本地缓存。
		extra, err := s.fetchHeaderData(missing, &imap.FetchOptions{
			UID: true, InternalDate: true, RFC822Size: true,
			BodySection: []*imap.FetchItemBodySection{section},
		})
		if err != nil {
			return nil, err
		}
		for uid, data := range extra {
			original, ok := headers[uid]
			if !ok {
				return nil, &protocolFailure{reason: "uid_out_of_range"}
			}
			original.merge(data)
		}
	}
	result, err := completeHeaders(headers)
	if err != nil {
		return nil, err
	}
	if err := s.confirmMissingHeaders(start, end, headers); err != nil {
		return nil, err
	}
	return result, nil
}

func (s *session) confirmMissingHeaders(start, end uint32, headers map[imap.UID]*headerData) error {
	if !s.searched {
		return nil
	}
	var missing imap.UIDSet
	for offset := uint32(0); offset <= end-start; offset++ {
		uid := imap.UID(start + offset)
		if s.uids.Contains(uid) && headers[uid] == nil {
			missing.AddNum(uid)
		}
	}
	if len(missing) == 0 {
		return nil
	}
	// UID 在 literal 后方时协议库可能丢弃整条响应。删除缓存前必须确认它确实不再存活，
	// 不能把解析丢失当作远端删除；只复核本窗口缺失的至多 100 个 UID，不扩展整个 UID 集。
	data, err := s.client.UIDSearch(&imap.SearchCriteria{UID: []imap.UIDSet{missing}}, nil).Wait()
	if err != nil {
		return s.commandError(err)
	}
	if data == nil {
		return &protocolFailure{reason: "incomplete_headers"}
	}
	live, ok := data.All.(imap.UIDSet)
	if !ok || live.Dynamic() || len(live) != 0 {
		return &protocolFailure{reason: "incomplete_headers"}
	}
	return nil
}

func completeHeaders(headers map[imap.UID]*headerData) ([]domain.RemoteMessage, error) {
	result := make([]domain.RemoteMessage, 0, len(headers))
	for _, header := range headers {
		if !header.complete() {
			return nil, &protocolFailure{reason: "incomplete_headers"}
		}
		message, envelope := header.value, header.value.Envelope
		result = append(result, domain.RemoteMessage{
			UID: uint32(message.UID), MessageID: bounded(envelope.MessageID, 998), Subject: bounded(envelope.Subject, 4096),
			From: formatAddresses(envelope.From), To: formatAddresses(envelope.To),
			ReceivedAt: message.InternalDate.UnixMilli(), Read: contains(message.Flags, imap.FlagSeen),
			Starred: contains(message.Flags, imap.FlagFlagged), Size: uint32(min(message.RFC822Size, 1<<32-1)),
		})
	}
	sort.Slice(result, func(i, j int) bool { return result[i].UID < result[j].UID })
	return result, nil
}
