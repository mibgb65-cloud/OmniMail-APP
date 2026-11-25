package security

import (
	"net/url"
	"regexp"
	"strings"
)

var (
	reAuthMech    = regexp.MustCompile(`(?i)\b(spf|dkim|dmarc)\s*=\s*(pass|fail|softfail|neutral|none|temperror|permerror)\b`)
	reAngleAddr   = regexp.MustCompile(`<\s*([^<>@\s]+@[^<>@\s]+)\s*>`)
	reValidDomain = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$`)
)

func ParseAuthResults(rawHeaders string) (spf, dkim, dmarc string) {
	spf, dkim, dmarc = "unknown", "unknown", "unknown"
	unfolded := strings.ReplaceAll(strings.ReplaceAll(rawHeaders, "\r\n ", " "), "\n ", " ")
	unfolded = strings.ReplaceAll(strings.ReplaceAll(unfolded, "\r\n\t", " "), "\n\t", " ")
	for _, line := range strings.Split(strings.ReplaceAll(unfolded, "\r\n", "\n"), "\n") {
		low := strings.ToLower(strings.TrimSpace(line))
		if strings.HasPrefix(low, "authentication-results:") || strings.HasPrefix(low, "arc-authentication-results:") {
			for _, m := range reAuthMech.FindAllStringSubmatch(low, -1) {
				switch m[1] {
				case "spf":
					if spf == "unknown" {
						spf = m[2]
					}
				case "dkim":
					if dkim == "unknown" {
						dkim = m[2]
					}
				case "dmarc":
					if dmarc == "unknown" {
						dmarc = m[2]
					}
				}
			}
		} else if strings.HasPrefix(low, "received-spf:") && spf == "unknown" {
			rest := strings.TrimSpace(strings.TrimPrefix(low, "received-spf:"))
			for _, st := range []string{"pass", "softfail", "fail", "neutral", "none"} {
				if strings.HasPrefix(rest, st) {
					spf = st
					break
				}
			}
		}
	}
	return spf, dkim, dmarc
}

func emailDomain(addr string) string {
	s := strings.TrimSpace(addr)
	if matches := reAngleAddr.FindAllStringSubmatch(s, -1); len(matches) > 0 {
		s = matches[len(matches)-1][1]
	}
	s = strings.ToLower(strings.Trim(s, "<>\"' \t\r\n."))
	at := strings.LastIndexByte(s, '@')
	if at < 0 || at >= len(s)-1 {
		return ""
	}
	dom := strings.Trim(s[at+1:], "<>\"' \t\r\n.")
	if !isValidMailDomain(dom) {
		return ""
	}
	return dom
}

func isValidMailDomain(dom string) bool {
	return dom != "" && len(dom) <= 253 && reValidDomain.MatchString(dom)
}

func urlDomain(raw string) string {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return ""
	}
	return strings.ToLower(u.Hostname())
}

func sameRegistrableDomain(a, b string) bool {
	return a == b || strings.HasSuffix(a, "."+b) || strings.HasSuffix(b, "."+a)
}
