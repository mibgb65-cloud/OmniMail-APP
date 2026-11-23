package syncer

import (
	"bytes"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"omnimail/internal/mailproto"
	"omnimail/internal/storage"
)

type preparedAttachmentRow struct {
	id, partID, fn, ext, mime, cid, kind, status, sha, path, prev string
	inlineInt                                                     int
	size                                                          int64
}

func findExistingIngestedMessage(db *sql.DB, in IngestInput, rfcClean string) (string, bool) {
	if in.RemoteUID > 0 {
		var existID string
		if db.QueryRow(`SELECT id FROM messages WHERE account_id=? AND remote_mailbox_id=? AND remote_uid=?`,
			in.AccountID, in.RemoteMailboxID, in.RemoteUID).Scan(&existID) == nil && existID != "" {
			return existID, true
		}
	}
	// Sent 去重：若本地发信队列已提前写入同 rfc_message_id 的已发送记录，直接绑定远端 UID
	if in.Folder == "sent" && rfcClean != "" && in.RemoteUID > 0 {
		var sentID string
		if db.QueryRow(`SELECT id FROM messages WHERE account_id=? AND folder='sent' AND rfc_message_id=? AND remote_uid=0 LIMIT 1`,
			in.AccountID, rfcClean).Scan(&sentID) == nil && sentID != "" {
			_, _ = db.Exec(`UPDATE messages SET remote_mailbox_id=?, remote_uid=? WHERE id=?`,
				in.RemoteMailboxID, in.RemoteUID, sentID)
			return sentID, true
		}
	}
	return "", false
}

func prepareAttachmentRows(blobs *storage.BlobStore, msgID string, items []mailproto.ParsedAttachment) ([]preparedAttachmentRow, []string, map[string]string) {
	cidMap := make(map[string]string)
	var rows []preparedAttachmentRow
	var attNames []string
	for idx, a := range items {
		aid := fmt.Sprintf("%s-att-%d", msgID, idx+1)
		st := "remote"
		var sha, dstPath string
		sz := int64(len(a.Data))
		if sz > 50*1024*1024 {
			st = "oversized"
		} else if blobs != nil && sz > 0 {
			if s, n, p, putErr := blobs.PutAttachment(bytes.NewReader(a.Data)); putErr == nil {
				st, sha, sz, dstPath = "ready", s, n, p
			}
		}
		inl := 0
		if a.IsInline {
			inl = 1
			if a.ContentID != "" {
				cidMap[a.ContentID] = aid
			}
		} else {
			attNames = append(attNames, a.Filename)
		}
		rows = append(rows, preparedAttachmentRow{
			id: aid, partID: a.PartID, fn: a.Filename, ext: a.Ext, mime: a.MimeType,
			cid: a.ContentID, kind: a.Kind, status: st, sha: sha, path: dstPath,
			prev: a.PreviewText, inlineInt: inl, size: sz,
		})
	}
	return rows, attNames, cidMap
}

func resolveIngestThread(tx *sql.Tx, in IngestInput, rfcClean string, recvMs int64, snippet string) (string, error) {
	var participants []string
	for _, addr := range append(append([]mailproto.EmailAddress{}, in.Parsed.To...), in.Parsed.Cc...) {
		participants = append(participants, addr.Email)
	}
	return mailproto.ResolveOrCreateThread(tx, mailproto.ThreadMatchInput{
		AccountID: in.AccountID, RFCMessageID: rfcClean, InReplyTo: in.Parsed.InReplyTo,
		References: in.Parsed.References, Subject: in.Parsed.Subject,
		SenderEmail: in.Parsed.Sender.Email, Participants: participants, ReceivedAtMs: recvMs,
	}, snippet)
}

func insertIngestedAuxRows(tx *sql.Tx, msgID string, parsed *mailproto.ParsedEmail, attRows []preparedAttachmentRow, attNames, labelIDs []string, nowMs int64) {
	for _, ar := range attRows {
		_, _ = tx.Exec(`
			INSERT INTO attachments(id, message_id, part_id, filename, ext, mime_type, content_id, is_inline, size_bytes, kind, status, blob_sha256, local_path, preview_text, last_access_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, ar.id, msgID, ar.partID, ar.fn, ar.ext, ar.mime, ar.cid, ar.inlineInt, ar.size, ar.kind, ar.status, ar.sha, ar.path, ar.prev, nowMs)
	}
	for _, lid := range labelIDs {
		_, _ = tx.Exec(`INSERT OR IGNORE INTO message_labels(message_id, label_id) VALUES (?, ?)`, msgID, lid)
	}
	_, _ = tx.Exec(`INSERT INTO messages_fts(message_id, subject, sender_name, sender_email, body_text, attachment_names) VALUES (?, ?, ?, ?, ?, ?)`,
		msgID, parsed.Subject, parsed.Sender.Name, parsed.Sender.Email, parsed.BodyText, strings.Join(attNames, " "))
}

func normalizeMessageTimes(receivedAt, sentAt time.Time) (int64, int64) {
	recvMs := receivedAt.UnixMilli()
	if recvMs <= 0 {
		recvMs = sentAt.UnixMilli()
	}
	sentMs := sentAt.UnixMilli()
	if sentMs <= 0 {
		sentMs = recvMs
	}
	return recvMs, sentMs
}

func deriveMessageID(accID, mbID string, uid uint32, rfcID string) string {
	seed := fmt.Sprintf("%s|%s|%d|%s|%d", accID, mbID, uid, rfcID, time.Now().UnixNano())
	sum := sha256.Sum256([]byte(seed))
	return "msg-" + hex.EncodeToString(sum[:10])
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
