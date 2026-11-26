package security

import "strings"

func sanitizeCSSStatements(css string, allowMedia bool) string {
	return sanitizeCSSStatementsScoped(css, allowMedia, nil)
}

func sanitizeCSSStatementsScoped(css string, allowMedia bool, scopes []string) string {
	var out []string
	for i, n := 0, len(css); i < n; {
		for i < n && (css[i] <= ' ' || css[i] == ';') {
			i++
		}
		if i >= n {
			break
		}
		if css[i] == '@' {
			headStart := i
			for i < n && css[i] != ';' && css[i] != '{' {
				i++
			}
			head := strings.TrimSpace(css[headStart:i])
			if i < n && css[i] == ';' {
				i++
				continue
			}
			if i < n && css[i] == '{' {
				body, nextIdx := readBalancedBraces(css, i)
				i = nextIdx
				lowHead := strings.ToLower(head)
				if allowMedia && (strings.HasPrefix(lowHead, "@media") || strings.HasPrefix(lowHead, "@supports")) {
					cleanHead := sanitizeAtRulePrelude(head)
					if cleanHead == "" {
						continue
					}
					if rewritten, handled := rewriteColorSchemeMediaRule(cleanHead, body); handled {
						if rewritten != "" {
							out = append(out, rewritten)
						}
						continue
					}
					inner := sanitizeCSSStatementsScoped(body, false, scopes)
					if inner != "" {
						out = append(out, cleanHead+" {\n"+inner+"\n}")
					}
				} else if strings.HasPrefix(lowHead, "@font-face") {
					if decls := sanitizeCSSDeclarationList(body); decls != "" && !strings.Contains(decls, "src: none") {
						out = append(out, "@font-face { "+decls+" }")
					}
				}
				continue
			}
			break
		}
		selStart := i
		for i < n && css[i] != '{' && css[i] != ';' {
			i++
		}
		if i >= n {
			break
		}
		if css[i] == ';' {
			i++
			continue
		}
		rawSel := strings.TrimSpace(css[selStart:i])
		body, nextIdx := readBalancedBraces(css, i)
		i = nextIdx
		cleanSel := rewriteAndValidateSelectors(rawSel)
		if len(scopes) > 0 && cleanSel != "" {
			cleanSel = scopeSelectorList(cleanSel, scopes)
		}
		cleanDecls := sanitizeCSSDeclarationList(body)
		if cleanSel != "" && cleanDecls != "" {
			out = append(out, cleanSel+" { "+cleanDecls+" }")
		}
	}
	return strings.Join(out, "\n")
}

func scopeSelectorList(cleanSel string, scopes []string) string {
	parts := splitTopLevelCommas(cleanSel)
	var scoped []string
	for _, rawPart := range parts {
		sel := strings.TrimSpace(rawPart)
		if sel == "" {
			continue
		}
		for _, sc := range scopes {
			scoped = append(scoped, scopeSingleSelector(sel, sc))
		}
	}
	return strings.Join(scoped, ", ")
}

func scopeSingleSelector(sel, scope string) string {
	const rootCls = ".mail-html-inner"
	attrPart := strings.TrimPrefix(scope, rootCls)
	if strings.HasPrefix(sel, rootCls) {
		rest := sel[len(rootCls):]
		if rest == "" || !isCSSIdentChar(rest[0]) {
			return rootCls + attrPart + rest
		}
	}
	return scope + " " + sel
}

func readBalancedBraces(s string, openIdx int) (string, int) {
	depth, inStr, start := 0, byte(0), openIdx+1
	for i := openIdx; i < len(s); i++ {
		ch := s[i]
		if inStr != 0 {
			if ch == '\\' && i+1 < len(s) {
				i++
			} else if ch == inStr {
				inStr = 0
			}
			continue
		}
		switch ch {
		case '"', '\'':
			inStr = ch
		case '{':
			depth++
		case '}':
			if depth--; depth == 0 {
				return s[start:i], i + 1
			}
		}
	}
	return s[start:], len(s)
}

func sanitizeAtRulePrelude(head string) string {
	low := strings.ToLower(head)
	for _, bad := range []string{"url(", "javascript:", "vbscript:", "expression(", "<", ">", "{", "}"} {
		if strings.Contains(low, bad) {
			return ""
		}
	}
	return strings.TrimSpace(head)
}

func sanitizeCSSDeclarationList(raw string) string {
	var kept []string
	for _, decl := range splitCSSDeclarations(raw) {
		colon := strings.IndexByte(decl, ':')
		if colon <= 0 {
			continue
		}
		prop := strings.ToLower(strings.TrimSpace(decl[:colon]))
		val := strings.TrimSpace(decl[colon+1:])
		lowVal := strings.ToLower(val)
		if !reSafeCSSProp.MatchString(prop) || prop == "behavior" || prop == "-moz-binding" ||
			(prop == "content" && strings.Contains(lowVal, "attr(")) || val == "" ||
			strings.Contains(lowVal, "expression(") || strings.Contains(lowVal, "javascript:") ||
			strings.Contains(lowVal, "vbscript:") || strings.Contains(lowVal, "-moz-binding") ||
			strings.Contains(lowVal, "behavior:") || strings.ContainsAny(val, "<>{}\\") {
			continue
		}
		if prop == "position" && reCSSFixedValue.MatchString(val) {
			val = reCSSFixedValue.ReplaceAllString(val, "static")
		}
		kept = append(kept, prop+": "+val)
	}
	return strings.Join(kept, "; ")
}

func splitCSSDeclarations(s string) []string {
	var out []string
	inStr, paren, start := byte(0), 0, 0
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if inStr != 0 {
			if ch == inStr {
				inStr = 0
			}
			continue
		}
		switch ch {
		case '"', '\'':
			inStr = ch
		case '(':
			paren++
		case ')':
			if paren > 0 {
				paren--
			}
		case ';':
			if paren == 0 {
				out = append(out, s[start:i])
				start = i + 1
			}
		}
	}
	return append(out, s[start:])
}
