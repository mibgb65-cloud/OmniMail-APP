package syncer

import (
	"bytes"
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/emersion/go-imap/v2"

	"omnimail/internal/accounts"
	"omnimail/internal/apperr"
	"omnimail/internal/events"
	"omnimail/internal/mailproto"
	"omnimail/internal/oauth"
	"omnimail/internal/search"
	"omnimail/internal/security"
	"omnimail/internal/storage"
)

func DownloadAttachment(
	ctx context.Context,
	db *sql.DB,
	vault *security.Vault,
	blobs *storage.BlobStore,
	tm *oauth.TokenManager,
	bus *events.Bus,
	attachmentID string,
	cacheLimitBytes int64,
) (search.AttachmentDTO, error) {
	var msgID, fn, ext, kind, status, blobSHA, prevTxt, accID, mbID, rawBlobSHA string
	var sizeBytes int64
	var remoteUID uint32

	err := db.QueryRow(`
		SELECT a.message_id, a.filename, a.ext, a.size_bytes, a.kind, a.status, a.blob_sha256, a.preview_text,
		       m.account_id, m.remote_mailbox_id, m.remote_uid, m.raw_blob_sha256
		FROM attachments a
		JOIN messages m ON m.id = a.message_id
		WHERE a.id = ?
	`, attachmentID).Scan(&msgID, &fn, &ext, &sizeBytes, &kind, &status, &blobSHA, &prevTxt, &accID, &mbID, &remoteUID, &rawBlobSHA)
	if err != nil {
		return search.AttachmentDTO{}, apperr.New(apperr.CodeNotFound, "未找到指定附件记录")
	}

	nowMs := time.Now().UnixMilli()
	if status == "ready" && blobSHA != "" {
		if p, pathErr := blobs.AttachmentPath(blobSHA); pathErr == nil {
			if _, statErr := os.Stat(p); statErr == nil {
				_, _ = db.Exec(`UPDATE attachments SET last_access_at=? WHERE id=?`, nowMs, attachmentID)
				return buildAttDTO(attachmentID, fn, ext, kind, "ready", prevTxt, sizeBytes), nil
			}
		}
	}

	emitAttProgress(bus, attachmentID, "downloading", 15, 0, sizeBytes)

	var rawEML []byte
	if rawBlobSHA != "" {
		rawEML, _ = blobs.GetRawEML(rawBlobSHA)
	}
	if len(rawEML) == 0 && remoteUID > 0 {
		epCfg, _, cfgErr := accounts.ResolveEndpointConfig(ctx, db, vault, tm, accID)
		if cfgErr != nil {
			return search.AttachmentDTO{}, cfgErr
		}
		cli, dialErr := mailproto.ConnectIMAP(ctx, epCfg, nil)
		if dialErr != nil {
			emitAttProgress(bus, attachmentID, "failed", 0, 0, sizeBytes)
			return search.AttachmentDTO{}, dialErr
		}
		defer func() {
			_ = cli.Logout().Wait()
			_ = cli.Close()
		}()
		remoteName := mbID
		if idx := strings.IndexByte(mbID, ':'); idx >= 0 && idx < len(mbID)-1 {
			remoteName = mbID[idx+1:]
		}
		if _, selErr := cli.Select(remoteName, &imap.SelectOptions{ReadOnly: true}).Wait(); selErr != nil {
			return search.AttachmentDTO{}, selErr
		}
		emitAttProgress(bus, attachmentID, "downloading", 45, sizeBytes/3, sizeBytes)
		var uidSet imap.UIDSet
		uidSet.AddNum(imap.UID(remoteUID))
		bodySec := &imap.FetchItemBodySection{Peek: true}
		fetched, fetchErr := cli.Fetch(uidSet, &imap.FetchOptions{UID: true, BodySection: []*imap.FetchItemBodySection{bodySec}}).Collect()
		if fetchErr != nil || len(fetched) == 0 {
			emitAttProgress(bus, attachmentID, "failed", 0, 0, sizeBytes)
			return search.AttachmentDTO{}, apperr.New(apperr.CodeConnFailed, "从远端邮局拉取附件数据失败")
		}
		rawEML = fetched[0].FindBodySection(bodySec)
		if len(rawEML) > 0 && rawBlobSHA == "" {
			if newSHA, putErr := blobs.PutRawEML(rawEML); putErr == nil {
				_, _ = db.Exec(`UPDATE messages SET raw_blob_sha256=? WHERE id=?`, newSHA, msgID)
			}
		}
	}

	parsed, parseErr := mailproto.ParseRawMessage(rawEML)
	if parseErr != nil {
		emitAttProgress(bus, attachmentID, "failed", 0, 0, sizeBytes)
		return search.AttachmentDTO{}, parseErr
	}
	var targetData []byte
	for _, pa := range parsed.Attachments {
		if pa.Filename == fn || len(parsed.Attachments) == 1 {
			targetData = pa.Data
			if prevTxt == "" && pa.PreviewText != "" {
				prevTxt = pa.PreviewText
			}
			break
		}
	}
	if len(targetData) == 0 {
		emitAttProgress(bus, attachmentID, "failed", 0, 0, sizeBytes)
		return search.AttachmentDTO{}, apperr.New(apperr.CodeNotFound, "邮件原始体中未找到匹配的附件内容")
	}

	sha, written, dstPath, err := blobs.PutAttachment(bytes.NewReader(targetData))
	if err != nil {
		emitAttProgress(bus, attachmentID, "failed", 0, 0, sizeBytes)
		return search.AttachmentDTO{}, err
	}
	_, _ = db.Exec(`UPDATE attachments SET status='ready', blob_sha256=?, size_bytes=?, local_path=?, preview_text=?, last_access_at=? WHERE id=?`,
		sha, written, dstPath, prevTxt, nowMs, attachmentID)
	_, _ = blobs.EnforceAttachmentLimit(db, cacheLimitBytes)
	emitAttProgress(bus, attachmentID, "ready", 100, written, written)
	return buildAttDTO(attachmentID, fn, ext, kind, "ready", prevTxt, written), nil
}

func emitAttProgress(bus *events.Bus, id, status string, pct int, dl, total int64) {
	if bus != nil {
		bus.Emit(events.AttachmentProgress, events.AttachmentProgressPayload{
			AttachmentID: id, Status: status, Progress: pct, DownloadedBytes: dl, TotalBytes: total,
		})
	}
}

func buildAttDTO(id, fn, ext, kind, status, preview string, size int64) search.AttachmentDTO {
	sizeTxt := fmt.Sprintf("%d B", size)
	if size >= 1024*1024 {
		sizeTxt = fmt.Sprintf("%.1f MB", float64(size)/(1024*1024))
	} else if size >= 1024 {
		sizeTxt = fmt.Sprintf("%d KB", (size+512)/1024)
	}
	return search.AttachmentDTO{
		ID: id, Name: fn, Ext: ext, SizeBytes: size, SizeText: sizeTxt,
		Kind: kind, Status: status, Progress: 100, PreviewSummary: preview,
		PreviewURL: "/omnimail-attachment/" + url.PathEscape(id),
	}
}
