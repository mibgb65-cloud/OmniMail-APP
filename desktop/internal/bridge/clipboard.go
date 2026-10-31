package bridge

import (
	"context"
	"errors"
	"net/mail"
	"strings"
	"unicode"
	"unicode/utf8"
)

func (b *AppBridge) CopyMailAddresses(ctx context.Context, value string) error {
	fail := errors.New("COPY_UNAVAILABLE")
	if ctx.Err() != nil || len(value) == 0 || len(value) > 4096 || !utf8.ValidString(value) ||
		strings.ContainsFunc(value, func(char rune) bool { return unicode.IsControl(char) || unicode.Is(unicode.Cf, char) }) {
		return fail
	}
	addresses, err := mail.ParseAddressList(value)
	if err != nil || len(addresses) == 0 || len(addresses) > 100 {
		return fail
	}
	normalized := make([]string, 0, len(addresses))
	for _, address := range addresses {
		if address.Name != "" || len(address.Address) > 320 {
			return fail
		}
		normalized = append(normalized, address.Address)
	}
	text := strings.Join(normalized, ", ")
	if len(text) > 4096 || ctx.Err() != nil || b.copyText == nil || !b.copyText(text) {
		return fail
	}
	return nil
}
