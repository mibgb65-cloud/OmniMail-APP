package outbox

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"omnimail/internal/accounts"
	"omnimail/internal/config"
	"omnimail/internal/events"
	"omnimail/internal/mailproto"
	"omnimail/internal/oauth"
	"omnimail/internal/profilemgr"
	"omnimail/internal/security"
)

type TransportFunc func(ctx context.Context, cfg mailproto.EndpointConfig, from string, rcpts []string, raw []byte) error

// Scheduler 管理持久化发件队列（撤销发送窗口、定时发送、断网退避重发与 Sent 同步）。
type Scheduler struct {
	mu                sync.Mutex
	sess              *profilemgr.Session
	tm                *oauth.TokenManager
	bus               *events.Bus
	loopCancel        context.CancelFunc
	transportOverride TransportFunc
	onMessageSent     func(db *sql.DB, accountID string, to, cc []mailproto.EmailAddress)
}

func NewScheduler(tm *oauth.TokenManager, bus *events.Bus) *Scheduler {
	if tm == nil {
		tm = oauth.NewTokenManager()
	}
	return &Scheduler{tm: tm, bus: bus}
}

func (s *Scheduler) SetTransportOverride(fn TransportFunc) {
	s.mu.Lock()
	s.transportOverride = fn
	s.mu.Unlock()
}

func (s *Scheduler) SetSentHook(fn func(db *sql.DB, accountID string, to, cc []mailproto.EmailAddress)) {
	s.mu.Lock()
	s.onMessageSent = fn
	s.mu.Unlock()
}

func (s *Scheduler) OnSessionOpened(sess *profilemgr.Session) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.loopCancel != nil {
		s.loopCancel()
	}
	s.sess = sess
	ctx, cancel := context.WithCancel(sess.Ctx)
	s.loopCancel = cancel
	go s.runTickerLoop(ctx, sess)
}

func (s *Scheduler) OnSessionClosing(sess *profilemgr.Session) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.sess != nil && s.sess.Meta.ID == sess.Meta.ID {
		if s.loopCancel != nil {
			s.loopCancel()
			s.loopCancel = nil
		}
		s.sess = nil
	}
}

func (s *Scheduler) OnSettingsChanged(_ *profilemgr.Session, _ config.AppSettings) {}

func (s *Scheduler) runTickerLoop(ctx context.Context, sess *profilemgr.Session) {
	// 启动时立即补扫一次（支持跨重启补发错过窗口的定时邮件与待发任务）
	s.processDueJobs(ctx, sess)
	tk := time.NewTicker(1 * time.Second)
	defer tk.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-tk.C:
			s.processDueJobs(ctx, sess)
		}
	}
}

// SendDraft 校验身份锁、构建 RFC5322 MIME 落盘 CAS，并进入 undo_pending 或 scheduled 状态。
func (s *Scheduler) SendDraft(sess *profilemgr.Session, req SendDraftRequest) (OutboxJobDTO, error) {
	var draft ComposeDraftState
	var err error
	if req.Draft != nil {
		cp := *req.Draft
		if req.DraftID != "" {
			cp.ID = req.DraftID
		}
		if req.UnlockIdentity {
			cp.UnlockIdentity = true
		}
		draft, err = SaveDraft(sess.DB, cp)
		if err != nil {
			return OutboxJobDTO{}, err
		}
	} else {
		draft, err = GetDraft(sess.DB, req.DraftID)
		if err != nil {
			return OutboxJobDTO{}, err
		}
		if err := VerifyDraftIdentityLock(sess.DB, draft.ID, draft.AccountID, req.UnlockIdentity); err != nil {
			return OutboxJobDTO{}, err
		}
	}

	acc, err := accounts.GetByID(sess.DB, sess.Vault, draft.AccountID)
	if err != nil {
		return OutboxJobDTO{}, err
	}
	inReplyTo, refs := resolveReplyHeaders(sess.DB, draft.ReplyToMailID)
	var outAtts []mailproto.OutgoingAttachment
	for _, a := range draft.Attachments {
		outAtts = append(outAtts, mailproto.OutgoingAttachment{
			Filename: a.Name,
			MimeType: a.MimeType,
			FilePath: a.FilePath,
		})
	}
	senderName := strings.TrimSpace(acc.SenderName)
	if senderName == "" {
		senderName = acc.Name
	}
	built, err := mailproto.BuildRFC5322(mailproto.BuildMessageInput{
		FromName: senderName, FromEmail: acc.Email, ReplyTo: acc.ReplyTo,
		To: draft.To, Cc: draft.Cc, Bcc: draft.Bcc,
		Subject: draft.Subject, BodyText: draft.Body, BodyHTML: draft.BodyHTML,
		InReplyTo: inReplyTo, References: refs, Attachments: outAtts,
	})
	if err != nil {
		return OutboxJobDTO{}, err
	}

	settings := config.LoadProfileSettings(sess.ProfileDir)
	nowMs := time.Now().UnixMilli()
	state := "undo_pending"
	notBefore := nowMs + int64(settings.UndoSendSeconds)*1000
	if req.BypassUndoWindow || settings.UndoSendSeconds <= 0 {
		notBefore = nowMs
	}
	if req.ScheduledAtUnixMs > nowMs {
		state = "scheduled"
		notBefore = req.ScheduledAtUnixMs
	}
	return s.persistJob(sess, draft.AccountID, draft.ID, draft.Subject, draft.Body, built, state, notBefore)
}

// EnqueueDirect 供日程 RSVP 与防循环休假自动回复直接入队投递（无需撤销窗口）。
func (s *Scheduler) EnqueueDirect(sess *profilemgr.Session, accountID string, in mailproto.BuildMessageInput) (OutboxJobDTO, error) {
	built, err := mailproto.BuildRFC5322(in)
	if err != nil {
		return OutboxJobDTO{}, err
	}
	nowMs := time.Now().UnixMilli()
	return s.persistJob(sess, accountID, "", in.Subject, in.BodyText, built, "undo_pending", nowMs)
}

func resolveReplyHeaders(db *sql.DB, origMailID string) (string, []string) {
	if strings.TrimSpace(origMailID) == "" {
		return "", nil
	}
	var rfcID, refsJSON string
	if db.QueryRow(`SELECT rfc_message_id, references_json FROM messages WHERE id = ?`, origMailID).Scan(&rfcID, &refsJSON) != nil {
		return "", nil
	}
	var refs []string
	_ = json.Unmarshal([]byte(refsJSON), &refs)
	if rfcID != "" {
		refs = append(refs, rfcID)
	}
	return rfcID, refs
}

func newRandomJobID(prefix string) string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%s-%d-%s", prefix, time.Now().UnixMilli(), hex.EncodeToString(b))
}

func sanitizeJobHTML(plain string) string {
	return security.PlainTextToHTML(plain)
}
