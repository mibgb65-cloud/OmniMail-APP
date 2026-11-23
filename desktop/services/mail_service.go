package services

import (
	"context"
	"strings"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"

	"omnimail/internal/apperr"
	"omnimail/internal/events"
	"omnimail/internal/oauth"
	"omnimail/internal/profilemgr"
	"omnimail/internal/search"
	"omnimail/internal/security"
	"omnimail/internal/syncer"
)

type RSVPResponder interface {
	RespondInvite(ctx context.Context, sess *profilemgr.Session, mailID, rsvp string) (search.MeetingInviteDTO, error)
	ExportICS(sess *profilemgr.Session, mailID, targetPath string) (string, error)
}

type MailService struct {
	mgr      *profilemgr.Manager
	bus      *events.Bus
	tokenMgr *oauth.TokenManager
	syncer   SyncDriver
	rsvp     RSVPResponder
	app      *application.App
	win      *application.WebviewWindow
}

func NewMailService(mgr *profilemgr.Manager, bus *events.Bus, tm *oauth.TokenManager) *MailService {
	if tm == nil {
		tm = oauth.NewTokenManager()
	}
	return &MailService{mgr: mgr, bus: bus, tokenMgr: tm}
}

func AttachMailRuntime(s *MailService, app *application.App, win *application.WebviewWindow, driver SyncDriver, rsvp RSVPResponder) {
	if s == nil {
		return
	}
	if app != nil {
		s.app = app
	}
	if win != nil {
		s.win = win
	}
	if driver != nil {
		s.syncer = driver
	}
	if rsvp != nil {
		s.rsvp = rsvp
	}
}

func (s *MailService) GetFolderCounts(accountID string) (search.FolderCounts, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return search.FolderCounts{}, err
	}
	return search.GetFolderCounts(sess.DB, strings.TrimSpace(accountID))
}

func (s *MailService) ListMessages(query search.MailSearchQuery) (search.MessageListPage, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return search.MessageListPage{}, err
	}
	cfg, _ := s.mgr.GetAppSettings()
	return search.ListMessages(sess.DB, query, cfg.BlockRemoteImages)
}

func (s *MailService) MatchMailIDs(query search.MailSearchQuery, ids []string) ([]string, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return nil, err
	}
	return search.MatchMailIDs(sess.DB, query, ids)
}

func (s *MailService) GetThreadDetail(threadID string) (search.MailItemDTO, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return search.MailItemDTO{}, err
	}
	cfg, _ := s.mgr.GetAppSettings()
	return search.GetThreadDetail(sess.DB, strings.TrimSpace(threadID), cfg.BlockRemoteImages)
}

func (s *MailService) AllowRemoteImages(mailID string) (string, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return "", err
	}
	id := strings.TrimSpace(mailID)
	var sanitized, secJSON string
	if err := sess.DB.QueryRow(`SELECT body_html_sanitized, security_json FROM messages WHERE id=?`, id).Scan(&sanitized, &secJSON); err != nil {
		return "", apperr.New(apperr.CodeNotFound, "未找到对应的邮件")
	}
	if strings.Contains(secJSON, `"danger"`) {
		return "", apperr.New(apperr.CodeInvalidInput, "高风险疑似钓鱼邮件已强制锁定外链图片拦截")
	}
	_, _ = sess.DB.Exec(`UPDATE messages SET remote_images_allowed=1 WHERE id=?`, id)
	return security.RestoreRemoteImages(sanitized), nil
}

func (s *MailService) MarkRead(mailIDs []string, isRead bool) error {
	sess, err := s.mgr.ActiveSession()
	if err != nil || len(mailIDs) == 0 {
		return err
	}
	accs, err := syncer.MarkReadLocalAndQueue(sess.DB, mailIDs, isRead)
	if err != nil {
		return err
	}
	s.kickSyncAndEmitDelta(sess, accs, mailIDs, nil)
	return nil
}

func (s *MailService) ToggleStar(mailIDs []string, isStarred bool) error {
	sess, err := s.mgr.ActiveSession()
	if err != nil || len(mailIDs) == 0 {
		return err
	}
	accs, err := syncer.ToggleStarLocalAndQueue(sess.DB, mailIDs, isStarred)
	if err != nil {
		return err
	}
	s.kickSyncAndEmitDelta(sess, accs, mailIDs, nil)
	return nil
}

func (s *MailService) MoveToFolder(mailIDs []string, targetFolder string) error {
	sess, err := s.mgr.ActiveSession()
	if err != nil || len(mailIDs) == 0 {
		return err
	}
	accs, err := syncer.MoveFolderLocalAndQueue(sess.DB, mailIDs, strings.TrimSpace(targetFolder))
	if err != nil {
		return err
	}
	s.kickSyncAndEmitDelta(sess, accs, mailIDs, nil)
	return nil
}

func (s *MailService) SnoozeMessages(mailIDs []string, wakeUpAtUnixMs int64) error {
	sess, err := s.mgr.ActiveSession()
	if err != nil || len(mailIDs) == 0 {
		return err
	}
	if wakeUpAtUnixMs <= time.Now().UnixMilli() {
		wakeUpAtUnixMs = time.Now().Add(3 * time.Hour).UnixMilli()
	}
	if err := syncer.SnoozeLocal(sess.DB, mailIDs, wakeUpAtUnixMs); err != nil {
		return err
	}
	s.kickSyncAndEmitDelta(sess, nil, mailIDs, nil)
	return nil
}

func (s *MailService) DeletePermanently(mailIDs []string) error {
	sess, err := s.mgr.ActiveSession()
	if err != nil || len(mailIDs) == 0 {
		return err
	}
	accs, err := syncer.DeletePermanentlyLocalAndQueue(sess.DB, mailIDs)
	if err != nil {
		return err
	}
	s.kickSyncAndEmitDelta(sess, accs, nil, mailIDs)
	return nil
}

func (s *MailService) EmptyTrash() error {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return err
	}
	rows, err := sess.DB.Query(`SELECT id FROM messages WHERE folder='trash'`)
	if err != nil {
		return err
	}
	var ids []string
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	_ = rows.Close()
	if len(ids) == 0 {
		return nil
	}
	return s.DeletePermanently(ids)
}
