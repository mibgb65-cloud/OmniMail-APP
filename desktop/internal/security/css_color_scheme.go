package security

import (
	"regexp"
	"strings"
)

var (
	darkColorSchemeScopes = []string{
		`.mail-html-inner[data-theme="dark"][data-html-mode="adaptive"]`,
	}
	lightColorSchemeScopes = []string{
		`.mail-html-inner[data-theme="light"]`,
		`.mail-html-inner[data-theme="dark"][data-html-mode="paper"]`,
	}
	rePrefersColorScheme = regexp.MustCompile(`(?i)^\(\s*prefers-color-scheme\s*:\s*([a-z-]+)\s*\)$`)
)

// RewriteLegacyColorSchemeHTML 对已入库存量邮件中的 <style> 块按需重写 prefers-color-scheme 规则。
func RewriteLegacyColorSchemeHTML(sanitizedHTML string) string {
	if !strings.Contains(strings.ToLower(sanitizedHTML), "prefers-color-scheme") {
		return sanitizedHTML
	}
	return reStyleBlock.ReplaceAllStringFunc(sanitizedHTML, func(block string) string {
		m := reStyleBlock.FindStringSubmatch(block)
		if len(m) != 2 || !strings.Contains(strings.ToLower(m[1]), "prefers-color-scheme") {
			return block
		}
		cleanCSS, _ := SanitizeMailCSS(m[1])
		if cleanCSS == "" {
			return ""
		}
		return "<style>" + cleanCSS + "</style>"
	})
}

func rewriteColorSchemeMediaRule(cleanHead, body string) (string, bool) {
	lowHead := strings.ToLower(cleanHead)
	if !strings.HasPrefix(lowHead, "@media") || !strings.Contains(lowHead, "prefers-color-scheme") {
		return "", false
	}
	mqRaw := strings.TrimSpace(cleanHead[len("@media"):])
	if mqRaw == "" {
		return "", true
	}

	var renderedBlocks []string
	for _, singleMQ := range splitTopLevelCommas(mqRaw) {
		mq := strings.TrimSpace(singleMQ)
		if mq == "" {
			continue
		}
		negated := false
		if len(mq) > 4 && strings.EqualFold(mq[:4], "not ") {
			negated = true
			mq = strings.TrimSpace(mq[4:])
		}
		clauses := splitMediaAndClauses(mq)
		scheme, invalid := "", false
		var kept []string
		for _, rawClause := range clauses {
			c := strings.TrimSpace(rawClause)
			if c == "" {
				continue
			}
			if m := rePrefersColorScheme.FindStringSubmatch(c); len(m) == 2 {
				val := strings.ToLower(m[1])
				if val != "dark" && val != "light" {
					invalid = true
					break
				}
				if negated && len(clauses) == 1 {
					if val == "dark" {
						val = "light"
					} else {
						val = "dark"
					}
					negated = false
				} else if negated || (scheme != "" && scheme != val) {
					invalid = true
					break
				}
				scheme = val
				continue
			}
			kept = append(kept, c)
		}
		if invalid {
			continue
		}
		if scheme == "" {
			if inner := sanitizeCSSStatementsScoped(body, false, nil); inner != "" {
				prefix := ""
				if negated {
					prefix = "not "
				}
				renderedBlocks = append(renderedBlocks, "@media "+prefix+strings.Join(kept, " and ")+" {\n"+inner+"\n}")
			}
			continue
		}
		scopes := darkColorSchemeScopes
		if scheme == "light" {
			scopes = lightColorSchemeScopes
		}
		scopedInner := sanitizeCSSStatementsScoped(body, false, scopes)
		if scopedInner == "" {
			continue
		}
		if remMedia := buildRemainingMediaQuery(kept); remMedia == "" {
			renderedBlocks = append(renderedBlocks, scopedInner)
		} else {
			renderedBlocks = append(renderedBlocks, "@media "+remMedia+" {\n"+scopedInner+"\n}")
		}
	}
	return strings.Join(renderedBlocks, "\n"), true
}

func buildRemainingMediaQuery(clauses []string) string {
	for _, c := range clauses {
		low := strings.ToLower(strings.Join(strings.Fields(c), " "))
		if low != "all" && low != "only all" && low != "screen" && low != "only screen" {
			return strings.Join(clauses, " and ")
		}
	}
	return ""
}

func splitMediaAndClauses(mq string) []string {
	var out []string
	depth, start := 0, 0
	for i := 0; i < len(mq); i++ {
		switch mq[i] {
		case '(':
			depth++
		case ')':
			if depth > 0 {
				depth--
			}
		default:
			if depth == 0 && i+3 <= len(mq) && strings.EqualFold(mq[i:i+3], "and") {
				leftOK := i == 0 || mq[i-1] <= ' ' || mq[i-1] == ')'
				rightOK := i+3 == len(mq) || mq[i+3] <= ' ' || mq[i+3] == '('
				if leftOK && rightOK {
					out = append(out, mq[start:i])
					i += 2
					start = i + 1
				}
			}
		}
	}
	return append(out, mq[start:])
}
