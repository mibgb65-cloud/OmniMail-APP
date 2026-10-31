package mailnet

import (
	"errors"
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestSelectRecoversMissingMetadataWithoutInventingIdentity(t *testing.T) {
	for _, test := range []struct {
		name      string
		options   mailboxFixtureOptions
		wantNext  uint32
		wantError bool
	}{
		{"complete_metadata", mailboxFixtureOptions{rejectStatus: true}, 1, false},
		{"status", mailboxFixtureOptions{omitNext: true, statusValidity: 7, statusNext: 10}, 10, false},
		{"search", mailboxFixtureOptions{omitNext: true, statusValidity: 7, searchUIDs: "1 5 9"}, 10, false},
		{"empty", mailboxFixtureOptions{omitNext: true, statusValidity: 7}, 1, false},
		{"validity_from_status", mailboxFixtureOptions{omitValidity: true, statusValidity: 7, statusNext: 1}, 1, false},
		{"missing_validity", mailboxFixtureOptions{omitValidity: true, statusNext: 1}, 0, true},
		{"epoch_changed", mailboxFixtureOptions{omitNext: true, statusValidity: 8, statusNext: 10}, 0, true},
		{"permission", mailboxFixtureOptions{omitNext: true, rejectStatus: true}, 0, true},
		{"overflow", mailboxFixtureOptions{omitNext: true, statusValidity: 7, searchUIDs: "4294967295"}, 0, true},
	} {
		t.Run(test.name, func(t *testing.T) {
			session := mailboxFixture(t, test.options)
			validity, next, err := session.Select("INBOX")
			if test.wantError {
				if !errors.Is(err, domain.ErrProtocol) {
					t.Fatal("缺失/冲突身份或服务器拒绝被当成有效邮箱")
				}
				return
			}
			if err != nil || validity != 7 || next != test.wantNext {
				t.Fatalf("没有恢复服务端元数据：validity=%d next=%d", validity, next)
			}
		})
	}
}
