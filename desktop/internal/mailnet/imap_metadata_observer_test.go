package mailnet

import (
	"fmt"
	"strings"
	"testing"
)

func TestMetadataObserverPreservesPresenceWithoutTrustingLiteralContent(t *testing.T) {
	fake := "* OK [UIDVALIDITY 0] fake\r\n"
	for _, test := range []struct {
		name, wire       string
		present, invalid bool
		value            uint32
	}{
		{"zero", "* OK [UIDVALIDITY 0] valid\r\n", true, false, 0},
		{"positive", "* OK [UIDVALIDITY 7] valid\r\n", true, false, 7},
		{"missing", "* OK [UIDNEXT 10] next\r\n", false, false, 0},
		{"text", "* OK diagnostic UIDVALIDITY 0\r\n", false, false, 0},
		{"literal", fmt.Sprintf("* 1 FETCH (BODY[] {%d}\r\n%s)\r\n", len(fake), fake), false, false, 0},
		{"literal_then_real", fmt.Sprintf("* STATUS {%d}\r\n%s (UIDNEXT 1)\r\n* OK [UIDVALIDITY 7] valid\r\n", len(fake), fake), true, false, 7},
		{"status_text_not_literal", "* OK text {90}\r\n* OK [UIDVALIDITY 0] valid\r\n", true, false, 0},
		{"quoted_not_literal", "* LIST () \"/\" \"{30}\"\r\n* OK [UIDVALIDITY 0] valid\r\n", true, false, 0},
		{"conflict", "* OK [UIDVALIDITY 7] first\r\n* OK [UIDVALIDITY 0] second\r\n", true, true, 7},
		{"overflow", "* OK [UIDVALIDITY 4294967296] bad\r\n", false, true, 0},
		{"oversize", strings.Repeat("x", 4097) + "\r\n" + fake, false, true, 0},
		{"bad_framing", "* OK [UIDVALIDITY 0] invalid\n", false, true, 0},
	} {
		t.Run(test.name, func(t *testing.T) {
			for _, chunk := range []int{1, 7, len(test.wire)} {
				observer := &metadataObserver{}
				observer.begin()
				for start := 0; start < len(test.wire); start += chunk {
					observer.observe([]byte(test.wire[start:min(start+chunk, len(test.wire))]))
				}
				got := observer.end()
				if got.present != test.present || got.invalid != test.invalid || got.value != test.value {
					t.Fatal("元数据存在性、分片或 literal 边界判断错误")
				}
				observer.observe([]byte(fake))
				observer.begin()
				if got := observer.end(); got.present || got.invalid {
					t.Fatal("不同 SELECT 之间残留旧身份")
				}
			}
		})
	}
}
