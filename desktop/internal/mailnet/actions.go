package mailnet

import (
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/emersion/go-imap/v2"
	"omnimail/desktop/internal/domain"
)

func (s *session) MoveMail(mailbox string, validity, uid uint32, destination string) (uint32, uint32, error) {
	validName := func(name string) bool {
		return name != "" && len(name) <= 1024 && utf8.ValidString(name) && !strings.ContainsFunc(name, unicode.IsControl)
	}
	if !validName(mailbox) || !validName(destination) || mailbox == destination || validity == 0 || uid == 0 {
		return 0, 0, domain.ErrProtocol
	}
	// go-imap 缺少 MOVE 时会自动 COPY+STORE+EXPUNGE；这里必须在调用前阻止该降级。
	if !s.client.Caps().Has(imap.CapMove) || !s.client.Caps().Has(imap.CapUIDPlus) {
		return 0, 0, domain.ErrActionUnsupported
	}
	selected, err := s.client.Select(mailbox, &imap.SelectOptions{}).Wait()
	if err != nil {
		return 0, 0, s.commandError(err)
	}
	if selected.UIDValidity != validity {
		return 0, 0, domain.ErrProtocol
	}
	s.uids, s.searched = nil, false
	data, err := s.client.Move(imap.UIDSetNum(imap.UID(uid)), destination).Wait()
	if err != nil {
		// 发出移动后断线可能已经成功，绝不自动重试，交由同步核对。
		return 0, 0, domain.ErrActionUncertain
	}
	source, sourceOK := data.SourceUIDs.(imap.UIDSet)
	dest, destOK := data.DestUIDs.(imap.UIDSet)
	if !sourceOK || !destOK || data.UIDValidity == 0 || len(source) != 1 || len(dest) != 1 ||
		source[0].Start != imap.UID(uid) || source[0].Stop != imap.UID(uid) || dest[0].Start == 0 || dest[0].Start != dest[0].Stop {
		return 0, 0, domain.ErrActionUncertain
	}
	return data.UIDValidity, uint32(dest[0].Start), nil
}
