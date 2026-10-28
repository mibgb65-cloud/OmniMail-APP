package mailnet

import (
	"sort"
	"strings"
	"unicode"

	"omnimail/desktop/internal/domain"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"
)

type session struct {
	client   *imapclient.Client
	stop     func() bool
	uids     imap.UIDSet
	searched bool
}

func (s *session) Close() error {
	s.stop()
	return s.client.Close()
}

func (s *session) Mailboxes() ([]domain.RemoteMailbox, error) {
	options := &imap.ListOptions{}
	if s.client.Caps().Has(imap.CapSpecialUse) {
		options.ReturnSpecialUse = true
	}
	command := s.client.List("", "*", options)
	result := []domain.RemoteMailbox{}
	overflow := false
	for box := command.Next(); box != nil; box = command.Next() {
		if len(result) >= 500 || len(box.Mailbox) > 1024 || strings.ContainsFunc(box.Mailbox, unicode.IsControl) {
			overflow = true
			continue
		}
		selectable := true
		attributes := []string{}
		for _, attr := range box.Attrs {
			attributes = append(attributes, string(attr))
			if attr == imap.MailboxAttrNoSelect {
				selectable = false
			}
		}
		if selectable {
			result = append(result, domain.RemoteMailbox{Name: box.Mailbox, Kind: mailboxKind(box.Mailbox, attributes)})
		}
	}
	if err := command.Close(); err != nil || overflow {
		return nil, domain.ErrProtocol
	}
	sort.SliceStable(result, func(i, j int) bool {
		priority := func(kind string) int {
			switch kind {
			case "inbox":
				return 0
			case "sent":
				return 1
			default:
				return 2
			}
		}
		return priority(result[i].Kind) < priority(result[j].Kind)
	})
	return result, nil
}

func mailboxKind(name string, attributes []string) string {
	values := append([]string{strings.ToLower(name)}, attributes...)
	for _, value := range values {
		switch strings.ToLower(value) {
		case "inbox":
			return "inbox"
		case "\\sent", "sent", "sent mail", "sent messages", "已发送":
			return "sent"
		case "\\drafts", "drafts", "草稿箱":
			return "drafts"
		case "\\trash", "trash", "deleted", "deleted messages", "已删除":
			return "deleted"
		case "\\archive", "archive", "归档":
			return "archive"
		}
	}
	return "other"
}

func (s *session) Select(name string) (uint32, uint32, error) {
	state, err := s.client.Select(name, &imap.SelectOptions{ReadOnly: true}).Wait()
	if err != nil {
		return 0, 0, domain.ErrProtocol
	}
	s.uids = nil
	s.searched = false
	return state.UIDValidity, uint32(state.UIDNext), nil
}

func (s *session) LocateUID(from uint32) (uint32, bool, error) {
	if !s.searched {
		data, err := s.client.UIDSearch(&imap.SearchCriteria{}, nil).Wait()
		if err != nil {
			return 0, false, domain.ErrProtocol
		}
		set, ok := data.All.(imap.UIDSet)
		if !ok || set.Dynamic() || len(set) > 1000000 {
			return 0, false, domain.ErrTooLarge
		}
		s.uids = set
		s.searched = true
	}
	// 保留压缩区间，不调用 AllUIDs/Nums 展开大集合；空 UID 洞不会触发数百万个 FETCH。
	for _, span := range s.uids {
		if span.Start == 0 || span.Stop == 0 || span.Start > span.Stop {
			return 0, false, domain.ErrProtocol
		}
		if uint32(span.Stop) < from {
			continue
		}
		return max(from, uint32(span.Start)), true, nil
	}
	return 0, false, nil
}

func (s *session) Headers(start, end uint32) ([]domain.RemoteMessage, error) {
	if start == 0 || end < start || end-start >= 100 {
		return nil, domain.ErrProtocol
	}
	var set imap.UIDSet
	set.AddRange(imap.UID(start), imap.UID(end))
	command := s.client.Fetch(set, &imap.FetchOptions{UID: true, Envelope: true, Flags: true,
		InternalDate: true, RFC822Size: true})
	result := []domain.RemoteMessage{}
	for data := command.Next(); data != nil; data = command.Next() {
		message := new(imapclient.FetchMessageBuffer)
		for item := data.Next(); item != nil; item = data.Next() {
			switch item := item.(type) {
			case imapclient.FetchItemDataUID:
				message.UID = item.UID
			case imapclient.FetchItemDataEnvelope:
				message.Envelope = item.Envelope
			case imapclient.FetchItemDataFlags:
				message.Flags = item.Flags
			case imapclient.FetchItemDataInternalDate:
				message.InternalDate = item.Time
			case imapclient.FetchItemDataRFC822Size:
				message.RFC822Size = item.Size
			case imapclient.FetchItemDataBodySection:
				closeIMAP(s.client)
				return nil, domain.ErrProtocol
			}
		}
		if message.Envelope == nil || uint32(message.UID) < start || uint32(message.UID) > end || len(result) >= 100 {
			closeIMAP(s.client)
			return nil, domain.ErrProtocol
		}
		envelope := message.Envelope
		result = append(result, domain.RemoteMessage{
			UID: uint32(message.UID), MessageID: bounded(envelope.MessageID, 998), Subject: bounded(envelope.Subject, 4096),
			From: formatAddresses(envelope.From), To: formatAddresses(envelope.To),
			ReceivedAt: message.InternalDate.UnixMilli(), Read: contains(message.Flags, imap.FlagSeen),
			Starred: contains(message.Flags, imap.FlagFlagged), Size: uint32(min(message.RFC822Size, 1<<32-1)),
		})
	}
	if err := command.Close(); err != nil {
		return nil, domain.ErrProtocol
	}
	return result, nil
}

func (s *session) Body(uid uint32, sink domain.AttachmentSink) (domain.DecodedMail, error) {
	section := &imap.FetchItemBodySection{Peek: true}
	command := s.client.Fetch(imap.UIDSetNum(imap.UID(uid)), &imap.FetchOptions{
		UID: true, BodySection: []*imap.FetchItemBodySection{section}})
	var result domain.DecodedMail
	var decodeError error = domain.ErrProtocol
	for message := command.Next(); message != nil; message = command.Next() {
		var responseUID imap.UID
		for item := message.Next(); item != nil; item = message.Next() {
			if identity, ok := item.(imapclient.FetchItemDataUID); ok {
				responseUID = identity.UID
				continue
			}
			body, ok := item.(imapclient.FetchItemDataBodySection)
			if !ok || body.Literal == nil {
				continue
			}
			literal := body.Literal
			if literal.Size() > maxRawBytes {
				closeIMAP(s.client)
				return result, domain.ErrTooLarge
			}
			result, decodeError = decodeReader(literal, literal.Size(), sink)
			if decodeError != nil {
				closeIMAP(s.client)
				return result, decodeError
			}
		}
		if responseUID != imap.UID(uid) {
			closeIMAP(s.client)
			return result, domain.ErrProtocol
		}
	}
	if err := command.Close(); err != nil {
		return result, domain.ErrProtocol
	}
	return result, decodeError
}

func formatAddresses(addresses []imap.Address) string {
	values := []string{}
	for _, address := range addresses {
		if len(values) >= 100 {
			break
		}
		values = append(values, bounded(address.Addr(), 320))
	}
	return bounded(strings.Join(values, ", "), 4096)
}

func contains(values []imap.Flag, target imap.Flag) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func bounded(value string, limit int) string {
	value = strings.ToValidUTF8(strings.Map(func(char rune) rune {
		if unicode.IsControl(char) {
			return -1
		}
		return char
	}, value), "\uFFFD")
	if len(value) > limit {
		return strings.ToValidUTF8(value[:limit], "")
	}
	return value
}
