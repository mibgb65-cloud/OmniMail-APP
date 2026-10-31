package mailnet

import (
	"github.com/emersion/go-imap/v2"
	"omnimail/desktop/internal/domain"
	"strings"
	"unicode"
	"unicode/utf8"
)

func (s *session) SetStarred(mailbox string, validity, uid uint32, starred bool) error {
	return s.setFlag(mailbox, validity, uid, imap.FlagFlagged, starred)
}

func (s *session) SetRead(mailbox string, validity, uid uint32, read bool) error {
	return s.setFlag(mailbox, validity, uid, imap.FlagSeen, read)
}

func (s *session) setFlag(mailbox string, validity, uid uint32, flag imap.Flag, enabled bool) error {
	if uid == 0 || validity == 0 || len(mailbox) == 0 || len(mailbox) > 1024 || !utf8.ValidString(mailbox) || strings.ContainsFunc(mailbox, unicode.IsControl) {
		return domain.ErrProtocol
	}
	selected, err := s.client.Select(mailbox, &imap.SelectOptions{}).Wait()
	if err != nil {
		return s.commandError(err)
	}
	if selected.UIDValidity != validity {
		return domain.ErrProtocol
	}
	s.uids, s.searched = nil, false
	op := imap.StoreFlagsDel
	if enabled {
		op = imap.StoreFlagsAdd
	}
	set := imap.UIDSetNum(imap.UID(uid))
	// 仅增减目标 Seen/Flagged，绝不能用 FLAGS= 覆盖其他状态或服务商自定义标记。
	// 非 SILENT 的 UID STORE 自带新 Flags 回执，避免每次额外往返一次 FETCH。
	result, err := s.client.Store(set, &imap.StoreFlags{Op: op, Flags: []imap.Flag{flag}}, nil).Collect()
	if err != nil {
		return s.commandError(err)
	}
	if len(result) != 1 || uint32(result[0].UID) != uid || contains(result[0].Flags, flag) != enabled {
		return domain.ErrProtocol
	}
	return nil
}
