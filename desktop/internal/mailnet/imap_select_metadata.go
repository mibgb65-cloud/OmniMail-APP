package mailnet

import (
	"math"

	"github.com/emersion/go-imap/v2"
)

func (s *session) selectedMetadata(name string, state *imap.SelectData) (uint32, uint32, error) {
	if state.UIDValidity != 0 && state.UIDNext != 0 {
		return state.UIDValidity, uint32(state.UIDNext), nil
	}
	status, err := s.client.Status(name, &imap.StatusOptions{UIDValidity: true, UIDNext: true}).Wait()
	if err != nil {
		return 0, 0, s.selectError(name, err)
	}
	if state.UIDValidity != 0 && status.UIDValidity != 0 && state.UIDValidity != status.UIDValidity {
		return 0, 0, &protocolFailure{reason: "uidvalidity_changed"}
	}
	if state.UIDValidity == 0 {
		state.UIDValidity = status.UIDValidity
	}
	if state.UIDValidity == 0 {
		return 0, 0, &protocolFailure{reason: "missing_uidvalidity"}
	}
	state.UIDNext = max(state.UIDNext, status.UIDNext)
	if state.UIDNext == 0 {
		next, err := s.existingUIDUpperBound()
		if err != nil {
			return 0, 0, err
		}
		state.UIDNext = imap.UID(next)
	}
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
