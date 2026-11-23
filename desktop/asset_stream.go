package main

import (
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"omnimail/internal/profilemgr"
)

func wrapAssetHandler(base http.Handler, mgr *profilemgr.Manager) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if strings.HasPrefix(p, "/omnimail-cid/") || strings.HasPrefix(p, "/omnimail-attachment/") {
			serveControlledAttachment(w, r, mgr)
			return
		}
		base.ServeHTTP(w, r)
	})
}

func serveControlledAttachment(w http.ResponseWriter, r *http.Request, mgr *profilemgr.Manager) {
	if mgr == nil {
		http.Error(w, "profile not active", http.StatusForbidden)
		return
	}
	sess, err := mgr.ActiveSession()
	if err != nil || sess == nil {
		http.Error(w, "profile locked", http.StatusForbidden)
		return
	}
	rawID := strings.TrimPrefix(r.URL.Path, "/omnimail-cid/")
	rawID = strings.TrimPrefix(rawID, "/omnimail-attachment/")
	attID, _ := url.PathUnescape(strings.TrimSpace(rawID))
	if attID == "" || strings.ContainsAny(attID, "/\\") {
		http.Error(w, "invalid attachment id", http.StatusBadRequest)
		return
	}

	var sha, mimeType, filename string
	err = sess.DB.QueryRow(`SELECT blob_sha256, mime_type, filename FROM attachments WHERE id = ?`, attID).Scan(&sha, &mimeType, &filename)
	if err != nil || sha == "" {
		http.Error(w, "attachment not cached locally", http.StatusNotFound)
		return
	}
	diskPath, err := sess.Blobs.AttachmentPath(sha)
	if err != nil {
		http.Error(w, "invalid blob hash", http.StatusNotFound)
		return
	}
	f, err := os.Open(diskPath)
	if err != nil {
		http.Error(w, "blob missing", http.StatusNotFound)
		return
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		http.Error(w, "stat failed", http.StatusInternalServerError)
		return
	}

	_, _ = sess.DB.Exec(`UPDATE attachments SET last_access_at = ? WHERE id = ?`, time.Now().UnixMilli(), attID)

	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'")
	if mimeType != "" {
		w.Header().Set("Content-Type", mimeType)
	}
	http.ServeContent(w, r, filename, st.ModTime(), f)
}
