package mailproto

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"
	"time"
)

var reReplyPrefix = regexp.MustCompile(`(?i)^(?:\s*(?:re|fwd|fw|回复|转发|答复)\s*[:：]\s*)+`)

func NormalizeSubject(subject string) string {
	s := strings.TrimSpace(subject)
	for {
		next := reReplyPrefix.ReplaceAllString(s, "")
		if next == s {
			break
		}
		s = strings.TrimSpace(next)
	}
	return strings.Join(strings.Fields(s), " ")
}

type ThreadMatchInput struct {
	AccountID    string
	RFCMessageID string
	InReplyTo    string
	References   []string
	Subject      string
	SenderEmail  string
	Participants []string
	ReceivedAtMs int64
}

// ResolveOrCreateThread 按 3 级优先级归并邮件会话并在事务中确保 threads 行已存在。
func ResolveOrCreateThread(tx *sql.Tx, in ThreadMatchInput, snippet string) (string, error) {
	// 1. 逆序遍历 References 与 In-Reply-To 查找同账号已有引用链
	chain := make([]string, 0, len(in.References)+1)
	chain = append(chain, in.References...)
	if in.InReplyTo != "" {
		chain = append(chain, in.InReplyTo)
	}
	for i := len(chain) - 1; i >= 0; i-- {
		refID := strings.Trim(strings.TrimSpace(chain[i]), "<>")
		if refID == "" {
			continue
		}
		var tid string
		err := tx.QueryRow(
			`SELECT thread_id FROM messages WHERE account_id = ? AND rfc_message_id = ? LIMIT 1`,
			in.AccountID, refID,
		).Scan(&tid)
		if err == nil && tid != "" {
			return tid, nil
		}
	}

	// 2. 规范化主题 + 14 天窗口 + 至少 1 位共同参与者兜底
	normSub := NormalizeSubject(in.Subject)
	if normSub != "" && normSub != "（无主题）" {
		windowMs := int64((14 * 24 * time.Hour).Milliseconds())
		minTs := in.ReceivedAtMs - windowMs
		maxTs := in.ReceivedAtMs + windowMs
		rows, err := tx.Query(`
			SELECT thread_id, subject, sender_email, to_json, cc_json
			FROM messages
			WHERE account_id = ? AND received_at BETWEEN ? AND ?
			ORDER BY received_at DESC LIMIT 60
		`, in.AccountID, minTs, maxTs)
		if err == nil {
			pSet := make(map[string]struct{})
			if in.SenderEmail != "" {
				pSet[strings.ToLower(in.SenderEmail)] = struct{}{}
			}
			for _, p := range in.Participants {
				if clean := strings.ToLower(strings.TrimSpace(p)); clean != "" {
					pSet[clean] = struct{}{}
				}
			}
			var matchedTID string
			for rows.Next() {
				var tid, sub, sEmail, toJ, ccJ string
				if rows.Scan(&tid, &sub, &sEmail, &toJ, &ccJ) == nil {
					if strings.EqualFold(NormalizeSubject(sub), normSub) && sharesParticipant(pSet, sEmail, toJ, ccJ) {
						matchedTID = tid
						break
					}
				}
			}
			_ = rows.Close()
			if matchedTID != "" {
				return matchedTID, nil
			}
		}
	}

	// 3. 新建会话
	seed := fmt.Sprintf("%s|%s|%s|%d", in.AccountID, in.RFCMessageID, normSub, in.ReceivedAtMs)
	sum := sha256.Sum256([]byte(seed))
	newTID := "thr-" + hex.EncodeToString(sum[:8])
	displaySub := normSub
	if displaySub == "" {
		displaySub = in.Subject
	}
	_, err := tx.Exec(`
		INSERT OR IGNORE INTO threads (id, account_id, subject, snippet, last_msg_at, msg_count, unread_count, has_star, has_attachment)
		VALUES (?, ?, ?, ?, ?, 1, 0, 0, 0)
	`, newTID, in.AccountID, displaySub, snippet, in.ReceivedAtMs)
	return newTID, err
}

func sharesParticipant(pSet map[string]struct{}, senderEmail, toJSON, ccJSON string) bool {
	if len(pSet) == 0 {
		return true
	}
	if _, ok := pSet[strings.ToLower(senderEmail)]; ok {
		return true
	}
	combined := strings.ToLower(toJSON + " " + ccJSON)
	for addr := range pSet {
		if addr != "" && strings.Contains(combined, addr) {
			return true
		}
	}
	return false
}

func RefreshThreadStats(tx *sql.Tx, threadID string) error {
	var count, unread, star, att int
	var lastAt int64
	err := tx.QueryRow(`
		SELECT COUNT(1),
		       COALESCE(SUM(CASE WHEN is_unread = 1 AND folder NOT IN ('trash','spam') THEN 1 ELSE 0 END), 0),
		       COALESCE(MAX(is_starred), 0),
		       COALESCE(MAX(has_attachments), 0),
		       COALESCE(MAX(received_at), 0)
		FROM messages WHERE thread_id = ?
	`, threadID).Scan(&count, &unread, &star, &att, &lastAt)
	if err != nil {
		return err
	}
	if count == 0 {
		_, _ = tx.Exec(`DELETE FROM threads WHERE id = ?`, threadID)
		return nil
	}
	var snippet string
	_ = tx.QueryRow(`SELECT snippet FROM messages WHERE thread_id = ? ORDER BY received_at DESC LIMIT 1`, threadID).Scan(&snippet)
	_, err = tx.Exec(`
		UPDATE threads SET msg_count=?, unread_count=?, has_star=?, has_attachment=?, last_msg_at=?, snippet=?
		WHERE id=?
	`, count, unread, star, att, lastAt, snippet, threadID)
	return err
}
