package musemail

import "context"

// StatusDTO 描述当前活跃工作空间中 Muse Mail 的脱敏状态（绝不包含任何 Cookie 或令牌）。
type StatusDTO struct {
	LoginStage      string `json:"loginStage"`      // "idle" | "login_open" | "verified" | "connected"
	Bound           bool   `json:"bound"`           // 是否已完成当前工作空间确认绑定
	VerifiedEmail   string `json:"verifiedEmail"`   // 已由同一认证连接核验的 @muse.ai 地址
	AccountName     string `json:"accountName"`     // 用户自定义名称或默认名称
	LastRefreshedAt int64  `json:"lastRefreshedAt"` // 最近成功刷新毫秒时间戳（0 表示尚未刷新）
	LastErrorCode   string `json:"lastErrorCode,omitempty"`
}

// VerifyResultDTO 返回同连接身份核验结果，供前端展示并由用户确认绑定。
type VerifyResultDTO struct {
	Email      string `json:"email"`
	LoginStage string `json:"loginStage"`
}

// LoginSessionProbeDTO 描述独立登录窗口本地 Cookie 池的轻量探测结果（不发起任何外部网关请求）。
type LoginSessionProbeDTO struct {
	WindowOpen   bool `json:"windowOpen"`
	SessionReady bool `json:"sessionReady"`
}

// ThreadSummaryDTO 表示会话列表单行归一化摘要（不伪造未读状态、星标或同步位点）。
type ThreadSummaryDTO struct {
	ID           string   `json:"id"`
	Subject      string   `json:"subject"`
	MessageCount int      `json:"messageCount"`
	Participants []string `json:"participants"`
	LastFrom     string   `json:"lastFrom"`
	LastFromName string   `json:"lastFromName"`
	Preview      string   `json:"preview"`
	CreatedAtMs  int64    `json:"createdAtMs"`
	TimeKnown    bool     `json:"timeKnown"`
}

// ThreadListDTO 表示当前页会话列表与绑定当前连接/代次的不透明游标。
type ThreadListDTO struct {
	Email           string             `json:"email"`
	AccountName     string             `json:"accountName"`
	Threads         []ThreadSummaryDTO `json:"threads"`
	NextCursor      string             `json:"nextCursor"`
	HasMore         bool               `json:"hasMore"`
	LastRefreshedAt int64              `json:"lastRefreshedAt"`
}

// AttachmentMetaDTO 仅暴露只读附件元数据，首版不传内容也不开放自动打开。
type AttachmentMetaDTO struct {
	Index    int    `json:"index"`
	Filename string `json:"filename"`
	MimeType string `json:"mimeType"`
	Size     int64  `json:"size"`
}

// MessageDTO 表示单封归一化只读邮件（首版仅提供纯文本段落，不含原始 HTML）。
type MessageDTO struct {
	ID              string              `json:"id"`
	ThreadID        string              `json:"threadId"`
	Direction       string              `json:"direction"` // "inbound" | "outbound" | "unknown"
	From            string              `json:"from"`
	FromName        string              `json:"fromName"`
	To              []string            `json:"to"`
	Cc              []string            `json:"cc"`
	Subject         string              `json:"subject"`
	CreatedAtMs     int64               `json:"createdAtMs"`
	TimeKnown       bool                `json:"timeKnown"`
	BodyText        string              `json:"bodyText"`
	MuseAuthVerdict string              `json:"museAuthVerdict,omitempty"`
	Attachments     []AttachmentMetaDTO `json:"attachments"`
}

// ThreadDetailDTO 表示当前已加载会话的完整消息列表。
type ThreadDetailDTO struct {
	ID       string       `json:"id"`
	Subject  string       `json:"subject"`
	Email    string       `json:"email"`
	Messages []MessageDTO `json:"messages"`
}

// RawCookie 表示从独立隔离 WebView2 容器提取的单枚 Cookie（仅在 Go 内存流转）。
type RawCookie struct {
	Name      string
	Value     string
	Domain    string
	ExpiresAt float64
	IsSession bool
}

// LoginWindow 抽象独立隔离的官方网页登录宿主，便于非 Windows 编译与离线单测替换。
type LoginWindow interface {
	IsAlive() bool
	ExtractMuseCookies(ctx context.Context) ([]RawCookie, error)
	Close() error
}

type LoginHostFactory func() (LoginWindow, error)

// GatewaySession 抽象单条已完成鉴权与握手的 Muse 只读网关连接。
type GatewaySession interface {
	GetMailboxEmail(ctx context.Context) (string, error)
	ListThreadsRaw(ctx context.Context, upstreamCursor string) ([]byte, error)
	GetThreadRaw(ctx context.Context, threadID string) ([]byte, error)
	Close() error
}

type GatewayConnector interface {
	Connect(ctx context.Context, cookieHeader string) (GatewaySession, error)
}
