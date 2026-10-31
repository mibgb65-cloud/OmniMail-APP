package mailnet

import (
	"errors"
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestSelectMetadataFallbackOnlyAppliesToOfficialNaverHost(t *testing.T) {
	for _, test := range []struct {
		host    string
		allowed bool
	}{
		{"imap.naver.com", true}, {"IMAP.NAVER.COM.", true},
		{"imap.naver.com.evil.invalid", false}, {"imap.gmail.com", false}, {"custom.example.invalid", false},
	} {
		if useSelectMetadataFallback(test.host) != test.allowed {
			t.Fatal("普通 SELECT 兼容越过官方主机边界")
		}
	}
}

func TestSelectAcceptsExplicitZeroOnlyForNaver(t *testing.T) {
	for _, allowed := range []bool{false, true} {
		value := mailboxFixture(t, mailboxFixtureOptions{
			omitValidity: true, explicitZeroValidity: true, allowSelectFallback: allowed,
		})
		validity, next, err := value.Select("INBOX")
		if !allowed {
			if !errors.Is(err, domain.ErrProtocol) {
				t.Fatal("其他服务商接受了零身份")
			}
			continue
		}
		if err != nil || validity != 0 || next != 1 {
			t.Fatal("NAVER 明确返回的零值仍被当成缺失")
		}
	}
}

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
		{"naver_select_identity", mailboxFixtureOptions{omitValidity: true, allowSelectFallback: true, selectValidity: 7, selectNext: 10}, 10, false},
		{"naver_no_identity_anywhere", mailboxFixtureOptions{omitValidity: true, allowSelectFallback: true, selectNext: 1}, 0, true},
		{"naver_select_denied", mailboxFixtureOptions{omitValidity: true, allowSelectFallback: true, rejectSelect: true}, 0, true},
		{"naver_status_denied", mailboxFixtureOptions{omitValidity: true, allowSelectFallback: true, rejectStatus: true, selectValidity: 7}, 0, true},
		{"naver_complete_does_not_select", mailboxFixtureOptions{allowSelectFallback: true, rejectSelect: true}, 1, false},
		{"naver_fresh_identity_discards_old_uidnext", mailboxFixtureOptions{omitValidity: true, statusNext: 100, allowSelectFallback: true, selectValidity: 7, searchUIDs: "1 5"}, 6, false},
	} {
		t.Run(test.name, func(t *testing.T) {
			session := mailboxFixture(t, test.options)
			validity, next, err := session.Select("INBOX")
			if test.wantError {
				if !errors.Is(err, domain.ErrProtocol) {
					t.Fatal("缺失/冲突身份或服务器拒绝被当成有效邮箱")
				}
				if test.name == "naver_no_identity_anywhere" {
					var failure *protocolFailure
					if !errors.As(err, &failure) || failure.reason != "missing_uidvalidity_after_select" {
						t.Fatal("补取后仍缺身份时没有保留可区分的安全原因")
					}
				}
				return
			}
			if err != nil || validity != 7 || next != test.wantNext {
				t.Fatalf("没有恢复服务端元数据：validity=%d next=%d", validity, next)
			}
		})
	}
}
