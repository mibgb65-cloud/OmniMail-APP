package search

import (
	"database/sql"
	"html"
	"net/url"
	"regexp"
	"strings"

	"omnimail/internal/security"
)

var (
	reLegacyCidSrc   = regexp.MustCompile(`(?is)<img\b[^>]*\bsrc\s*=\s*(?:"cid:[^"]*"|'cid:[^']*')[^>]*>`)
	reOmniCidImg     = regexp.MustCompile(`(?is)<img\b[^>]*\bsrc\s*=\s*"(/omnimail-cid/([^"?#]+))"[^>]*>`)
	reHasOmniCidAttr = regexp.MustCompile(`(?i)\bdata-omnimail-cid\s*=`)
)

// repairLegacyInlineCIDHTML 兼容存量邮件：补齐旧版入库缺失的 cid 映射与 data-omnimail-cid 属性，便于前端按需重载。
func repairLegacyInlineCIDHTML(db *sql.DB, msgID, htmlBody string) string {
	if db == nil || strings.TrimSpace(htmlBody) == "" {
		return htmlBody
	}
	out := htmlBody
	if reLegacyCidSrc.MatchString(out) {
		cidMap := loadMessageCIDMap(db, msgID)
		if len(cidMap) > 0 {
			out, _ = security.SanitizeMailHTML(out, cidMap)
		}
	}
	if strings.Contains(out, "/omnimail-cid/") {
		out = reOmniCidImg.ReplaceAllStringFunc(out, func(tag string) string {
			if reHasOmniCidAttr.MatchString(tag) {
				return tag
			}
			m := reOmniCidImg.FindStringSubmatch(tag)
			if len(m) < 3 {
				return tag
			}
			attID := m[2]
			if unesc, err := url.PathUnescape(attID); err == nil && unesc != "" {
				attID = unesc
			}
			idx := strings.Index(tag, m[1])
			if idx < 0 {
				return tag
			}
			insertPos := idx + len(m[1]) + 1
			if insertPos > len(tag) {
				return tag
			}
			return tag[:insertPos] + ` data-omnimail-cid="` + html.EscapeString(attID) + `"` + tag[insertPos:]
		})
	}
	return out
}

func loadMessageCIDMap(db *sql.DB, msgID string) map[string]string {
	rows, err := db.Query(`SELECT id, content_id FROM attachments WHERE message_id = ? AND content_id != ''`, msgID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	out := make(map[string]string)
	for rows.Next() {
		var id, cid string
		if rows.Scan(&id, &cid) == nil {
			if nk := security.NormalizeContentID(cid); nk != "" {
				out[nk] = id
			}
		}
	}
	return out
}
