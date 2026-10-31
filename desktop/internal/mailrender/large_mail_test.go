package mailrender

import (
	"strings"
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestLargerHTMLIsSanitizedWithoutDroppingValidContent(t *testing.T) {
	source := "<p>" + strings.Repeat("x", 2<<20) + "</p><script>private-script</script>"
	cleaned := Sanitize(source, nil)
	if len(cleaned) < 2<<20 || strings.Contains(cleaned, "private-script") {
		t.Fatal("较大合法 HTML 消失或安全清洗被绕过")
	}
	if Sanitize(strings.Repeat("x", domain.MaxMessageTextBytes+1), nil) != "" {
		t.Fatal("展示端未保留 8 MiB 上限")
	}
}
