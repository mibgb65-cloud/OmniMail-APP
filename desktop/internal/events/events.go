package events

import (
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
)

const (
	ProfileSwitched    = "omnimail:profile:switched"
	AccountOAuthResult = "omnimail:account:oauth-result"
	AccountStatus      = "omnimail:account:status"
	SyncProgress       = "omnimail:sync:progress"
	MailDelta          = "omnimail:mail:delta"
	OutboxUpdated      = "omnimail:outbox:updated"
	AttachmentProgress = "omnimail:attachment:progress"
	AiChunk            = "omnimail:ai:chunk"
	AiDone             = "omnimail:ai:done"
	AiError            = "omnimail:ai:error"
	DesktopIntent      = "omnimail:desktop:intent"
)

type ProfileSwitchedPayload struct {
	ProfileID       string `json:"profileId"`
	ProfileName     string `json:"profileName"`
	ThemePreference string `json:"themePreference"`
}

type AccountOAuthResultPayload struct {
	FlowID       string `json:"flowId"`
	OK           bool   `json:"ok"`
	Account      any    `json:"account,omitempty"`
	ErrorCode    string `json:"errorCode,omitempty"`
	ErrorMessage string `json:"errorMessage,omitempty"`
}

type AccountStatusPayload struct {
	AccountID    string `json:"accountId"`
	Status       string `json:"status"`
	LastError    string `json:"lastError"`
	LastSyncedAt int64  `json:"lastSyncedAt"`
}

type SyncProgressPayload struct {
	AccountID string `json:"accountId"`
	Status    string `json:"status"`
	Stage     string `json:"stage"`
	Current   int    `json:"current"`
	Total     int    `json:"total"`
}

type MailDeltaPayload struct {
	AccountID    string         `json:"accountId"`
	AddedIDs     []string       `json:"addedIds,omitempty"`
	UpdatedIDs   []string       `json:"updatedIds,omitempty"`
	RemovedIDs   []string       `json:"removedIds,omitempty"`
	FolderCounts map[string]int `json:"folderCounts,omitempty"`
}

type OutboxUpdatedPayload struct {
	JobID       string `json:"jobId"`
	State       string `json:"state"`
	NotBeforeAt int64  `json:"notBeforeAt"`
	LastError   string `json:"lastError,omitempty"`
}

type AttachmentProgressPayload struct {
	AttachmentID    string `json:"attachmentId"`
	Status          string `json:"status"`
	Progress        int    `json:"progress"`
	DownloadedBytes int64  `json:"downloadedBytes"`
	TotalBytes      int64  `json:"totalBytes"`
}

type AiChunkPayload struct {
	RequestID string `json:"requestId"`
	MailID    string `json:"mailId,omitempty"`
	Delta     string `json:"delta"`
}

type AiDonePayload struct {
	RequestID string `json:"requestId"`
	MailID    string `json:"mailId,omitempty"`
	FullText  string `json:"fullText"`
	Tokens    int    `json:"tokens,omitempty"`
}

type AiErrorPayload struct {
	RequestID string `json:"requestId"`
	MailID    string `json:"mailId,omitempty"`
	RunStatus string `json:"runStatus"`
	Message   string `json:"message"`
}

type DesktopIntentPayload struct {
	Type    string `json:"type"`
	Payload string `json:"payload,omitempty"`
}

// Bus 封装 Wails v3 事件推送，并在单测无窗口环境下支持本地监听器断言。
type Bus struct {
	mu        sync.RWMutex
	app       *application.App
	listeners []func(name string, payload any)
}

func NewBus() *Bus {
	return &Bus{}
}

func (b *Bus) BindApp(app *application.App) {
	b.mu.Lock()
	b.app = app
	b.mu.Unlock()
}

func (b *Bus) Subscribe(fn func(name string, payload any)) {
	b.mu.Lock()
	b.listeners = append(b.listeners, fn)
	b.mu.Unlock()
}

func (b *Bus) Emit(name string, payload any) {
	if b == nil {
		return
	}
	b.mu.RLock()
	app := b.app
	subs := make([]func(string, any), len(b.listeners))
	copy(subs, b.listeners)
	b.mu.RUnlock()

	if app != nil {
		app.Event.Emit(name, payload)
	}
	for _, fn := range subs {
		fn(name, payload)
	}
}
