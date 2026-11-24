package outbox

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/mailproto"
	"omnimail/internal/profilemgr"
)

const (
	MaxInlineImageBytes     = 10 * 1024 * 1024
	MaxDraftAttachmentBytes = 25 * 1024 * 1024
)

type DraftInlineImageDTO struct {
	AttachmentID string `json:"attachmentId"`
	ContentID    string `json:"contentId"`
	URL          string `json:"url"`
	Filename     string `json:"filename"`
	MimeType     string `json:"mimeType"`
	SizeBytes    int64  `json:"sizeBytes"`
}

var (
	cidRefRe          = regexp.MustCompile(`/omnimail-cid/([A-Za-z0-9._-]+)`)
	allowedImageMimes = map[string]string{
		"image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif",
		"image/webp": ".webp", "image/bmp": ".bmp", "image/avif": ".avif",
	}
)

func SaveDraftInlineImage(sess *profilemgr.Session, draftID, filename, mimeType, base64Data string) (DraftInlineImageDTO, error) {
	raw, err := decodeBase64Payload(base64Data, MaxInlineImageBytes, "单张内嵌图片不能超过 10 MB")
	if err != nil {
		return DraftInlineImageDTO{}, err
	}
	return storeDraftInlineBytes(sess, draftID, filename, mimeType, raw)
}

func SaveDraftInlineImageFromPath(sess *profilemgr.Session, draftID, filePath string) (DraftInlineImageDTO, error) {
	cleanPath := filepath.Clean(strings.TrimSpace(filePath))
	if cleanPath == "" || cleanPath == "." {
		return DraftInlineImageDTO{}, apperr.New(apperr.CodeInvalidInput, "无效的图片文件路径")
	}
	st, err := os.Stat(cleanPath)
	if err != nil || st.IsDir() {
		return DraftInlineImageDTO{}, apperr.New(apperr.CodeInvalidInput, "无法读取所选图片文件")
	}
	if st.Size() <= 0 || st.Size() > MaxInlineImageBytes {
		return DraftInlineImageDTO{}, apperr.New(apperr.CodeInvalidInput, "单张内嵌图片不能超过 10 MB")
	}
	raw, err := os.ReadFile(cleanPath)
	if err != nil {
		return DraftInlineImageDTO{}, apperr.New(apperr.CodeInvalidInput, "读取图片失败")
	}
	mt := mime.TypeByExtension(strings.ToLower(filepath.Ext(cleanPath)))
	return storeDraftInlineBytes(sess, draftID, filepath.Base(cleanPath), mt, raw)
}

func SaveDraftAttachmentBytes(sess *profilemgr.Session, draftID, filename, mimeType, base64Data string) (DraftAttachmentDTO, error) {
	raw, err := decodeBase64Payload(base64Data, MaxDraftAttachmentBytes, "单个拖拽附件不能超过 25 MB")
	if err != nil {
		return DraftAttachmentDTO{}, err
	}
	cleanName := mailproto.SanitizeFilename(filename)
	mt := strings.TrimSpace(mimeType)
	if mt == "" {
		mt = mime.TypeByExtension(strings.ToLower(filepath.Ext(cleanName)))
	}
	if mt == "" {
		mt = "application/octet-stream"
	}
	_, sz, dstPath, err := sess.Blobs.PutAttachment(bytes.NewReader(raw))
	if err != nil {
		return DraftAttachmentDTO{}, err
	}
	return DraftAttachmentDTO{
		ID: newRandomJobID("att"), Name: cleanName, SizeBytes: sz,
		SizeText: formatBytes(sz), FilePath: dstPath, MimeType: mt, Status: "ready",
	}, nil
}

// LoadDraftInlineImages 仅加载 HTML 正文中实际引用的 /omnimail-cid/{id} 图片数据供 MIME 组装使用。
func LoadDraftInlineImages(sess *profilemgr.Session, bodyHTML string) []mailproto.InlineImage {
	if sess == nil || strings.TrimSpace(bodyHTML) == "" {
		return nil
	}
	matches := cidRefRe.FindAllStringSubmatch(bodyHTML, -1)
	if len(matches) == 0 {
		return nil
	}
	seen := make(map[string]bool, len(matches))
	out := make([]mailproto.InlineImage, 0, len(matches))
	for _, m := range matches {
		if len(m) < 2 || seen[m[1]] {
			continue
		}
		id := m[1]
		seen[id] = true
		var cid, fn, mt, sha string
		err := sess.DB.QueryRow(`SELECT content_id, filename, mime_type, blob_sha256 FROM draft_inline_images WHERE id = ?`, id).
			Scan(&cid, &fn, &mt, &sha)
		if err != nil || sha == "" {
			err = sess.DB.QueryRow(`SELECT COALESCE(NULLIF(content_id,''), id), filename, mime_type, blob_sha256 FROM attachments WHERE id = ? AND status = 'ready'`, id).
				Scan(&cid, &fn, &mt, &sha)
		}
		if err != nil || sha == "" {
			continue
		}
		diskPath, pErr := sess.Blobs.AttachmentPath(sha)
		if pErr != nil {
			continue
		}
		data, rErr := os.ReadFile(diskPath)
		if rErr != nil || len(data) == 0 {
			continue
		}
		if cid == "" {
			cid = id + "@omnimail.local"
		}
		out = append(out, mailproto.InlineImage{
			AttachmentID: id, ContentID: cid, Filename: fn, MimeType: mt, Data: data,
		})
	}
	return out
}

func storeDraftInlineBytes(sess *profilemgr.Session, draftID, filename, mimeType string, raw []byte) (DraftInlineImageDTO, error) {
	mt := strings.ToLower(strings.TrimSpace(strings.Split(mimeType, ";")[0]))
	if mt == "image/jpg" {
		mt = "image/jpeg"
	}
	if _, ok := allowedImageMimes[mt]; !ok {
		mt = strings.ToLower(strings.TrimSpace(strings.Split(http.DetectContentType(raw), ";")[0]))
	}
	ext, ok := allowedImageMimes[mt]
	if !ok {
		return DraftInlineImageDTO{}, apperr.New(apperr.CodeInvalidInput, "仅支持 PNG/JPEG/GIF/WebP/BMP/AVIF 格式图片")
	}
	cleanName := mailproto.SanitizeFilename(filename)
	if cleanName == "attachment.bin" || !strings.Contains(cleanName, ".") {
		cleanName = "image" + ext
	}
	sha, sz, _, err := sess.Blobs.PutAttachment(bytes.NewReader(raw))
	if err != nil {
		return DraftInlineImageDTO{}, err
	}
	rnd := make([]byte, 5)
	_, _ = rand.Read(rnd)
	nowMs := time.Now().UnixMilli()
	attID := fmt.Sprintf("dimg-%d-%s", nowMs, hex.EncodeToString(rnd))
	cid := fmt.Sprintf("img-%d-%s@omnimail.local", nowMs, hex.EncodeToString(rnd))
	cleanDraftID := strings.TrimPrefix(strings.TrimSpace(draftID), "draftmsg-")
	if _, err := sess.DB.Exec(`
		INSERT INTO draft_inline_images(id, draft_id, content_id, filename, mime_type, size_bytes, blob_sha256, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, attID, cleanDraftID, cid, cleanName, mt, sz, sha, nowMs); err != nil {
		return DraftInlineImageDTO{}, err
	}
	return DraftInlineImageDTO{
		AttachmentID: attID, ContentID: cid, URL: "/omnimail-cid/" + attID,
		Filename: cleanName, MimeType: mt, SizeBytes: sz,
	}, nil
}

func decodeBase64Payload(rawB64 string, maxBytes int, tooLargeMsg string) ([]byte, error) {
	clean := strings.TrimSpace(rawB64)
	if idx := strings.Index(clean, ";base64,"); idx >= 0 {
		clean = clean[idx+len(";base64,"):]
	}
	if clean == "" {
		return nil, apperr.New(apperr.CodeInvalidInput, "文件内容为空")
	}
	if base64.StdEncoding.DecodedLen(len(clean)) > maxBytes+1024 {
		return nil, apperr.New(apperr.CodeInvalidInput, tooLargeMsg)
	}
	raw, err := base64.StdEncoding.DecodeString(clean)
	if err != nil {
		return nil, apperr.New(apperr.CodeInvalidInput, "无效的 Base64 文件数据")
	}
	if len(raw) == 0 {
		return nil, apperr.New(apperr.CodeInvalidInput, "文件内容为空")
	}
	if len(raw) > maxBytes {
		return nil, apperr.New(apperr.CodeInvalidInput, tooLargeMsg)
	}
	return raw, nil
}
