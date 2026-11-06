package mailnet

import (
	"math"
	"strings"

	"github.com/emersion/go-imap/v2"
)

func useSelectMetadataFallback(host string) bool {
	return strings.EqualFold(strings.TrimSuffix(host, "."), "imap.naver.com")
}

func (s *session) selectedMetadata(name string, state *imap.SelectData) (uint32, uint32, error) {
	explicitZero := s.selectMetadataFallback && s.selection.present && !s.selection.invalid &&
		s.selection.value == 0 && state.UIDValidity == 0
	if s.selectMetadataFallback && (s.selection.invalid || (s.selection.present && s.selection.value != state.UIDValidity)) {
		return 0, 0, &protocolFailure{reason: "uidvalidity_changed"}
	}
	if (state.UIDValidity != 0 || explicitZero) && state.UIDNext != 0 {
		s.zeroValidity = explicitZero
		return state.UIDValidity, uint32(state.UIDNext), nil
	}
	status, err := s.client.Status(name, &imap.StatusOptions{UIDValidity: true, UIDNext: true}).Wait()
	if err != nil {
		return 0, 0, s.selectError(name, err)
	}
	if (state.UIDValidity != 0 || explicitZero) && status.UIDValidity != 0 && state.UIDValidity != status.UIDValidity {
		return 0, 0, &protocolFailure{reason: "uidvalidity_changed"}
	}
	if state.UIDValidity == 0 && !explicitZero {
		state.UIDValidity = status.UIDValidity
	}
	if state.UIDValidity == 0 && !explicitZero {
		if !s.selectMetadataFallback {
			return 0, 0, &protocolFailure{reason: "missing_uidvalidity"}
		}
		// NAVER 的 EXAMINE/STATUS 可能缺少身份字段；仅补一次 SELECT，
		// 采用服务器返回的新快照，不能编造 UIDVALIDITY，正文仍以 BODY.PEEK 读取。
		selected, err := s.selectObserved(name, nil)
		if err != nil {
			return 0, 0, s.selectError(name, err)
		}
		if s.selection.invalid || (s.selection.present && s.selection.value != selected.UIDValidity) {
			return 0, 0, &protocolFailure{reason: "uidvalidity_changed"}
		}
		explicitZero = s.selection.present && !s.selection.invalid && s.selection.value == 0 && selected.UIDValidity == 0
		if selected.UIDValidity == 0 && !explicitZero {
			return 0, 0, &protocolFailure{reason: "missing_uidvalidity_after_select"}
		}
		state = selected
	} else {
		state.UIDNext = max(state.UIDNext, status.UIDNext)
	}
	if state.UIDNext == 0 {
		next, err := s.existingUIDUpperBound()
		if err != nil {
			return 0, 0, err
		}
		state.UIDNext = imap.UID(next)
	}
	s.zeroValidity = explicitZero
	return state.UIDValidity, uint32(state.UIDNext), nil
}

func (s *session) existingUIDUpperBound() (uint32, error) {
	data, err := s.client.UIDSearch(&imap.SearchCriteria{}, nil).Wait()
	if err != nil {
		return 0, s.commandError(err)
	}
	set, ok := data.All.(imap.UIDSet)
	if !ok || set.Dynamic() || len(set) > 1000000 {
		return 0, &protocolFailure{reason: "uid_out_of_range"}
	}
	var last imap.UID
	for _, span := range set {
		if span.Start == 0 || span.Stop == 0 || span.Start > span.Stop || span.Stop == math.MaxUint32 {
			return 0, &protocolFailure{reason: "uid_out_of_range"}
		}
		last = max(last, span.Stop)
	}
	s.uids, s.searched = set, true
	// 只作为本轮已有邮件的读取上界，不伪造服务器未来分配的 UID；保留压缩集合，不展开大区间。
	return uint32(last) + 1, nil
}
