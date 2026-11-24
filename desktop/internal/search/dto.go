package search

type MailLabelDTO struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

type AttachmentDTO struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Ext            string `json:"ext"`
	SizeText       string `json:"sizeText"`
	SizeBytes      int64  `json:"sizeBytes"`
	Kind           string `json:"kind"`
	Status         string `json:"status"`
	Progress       int    `json:"progress,omitempty"`
	PreviewSummary string `json:"previewSummary,omitempty"`
	PreviewURL     string `json:"previewUrl,omitempty"`
}

type ThreadMessageDTO struct {
	ID             string   `json:"id"`
	SenderName     string   `json:"senderName"`
	SenderEmail    string   `json:"senderEmail"`
	Recipients     string   `json:"recipients"`
	Cc             string   `json:"cc,omitempty"`
	TimeText       string   `json:"timeText"`
	BodyParagraphs []string `json:"bodyParagraphs"`
	BodyHTML       string   `json:"bodyHtml,omitempty"`
	Collapsed      bool     `json:"collapsed,omitempty"`
}

type SecurityWarningDTO struct {
	Level  string `json:"level"`
	Title  string `json:"title"`
	Detail string `json:"detail"`
	SPF    string `json:"spf"`
	DKIM   string `json:"dkim"`
	DMARC  string `json:"dmarc"`
}

type AttendeeDTO struct {
	Name   string `json:"name"`
	Role   string `json:"role"`
	Status string `json:"status"`
}

type MeetingInviteDTO struct {
	Title          string        `json:"title"`
	MonthLabel     string        `json:"monthLabel"`
	DayNumber      string        `json:"dayNumber"`
	DateTimeText   string        `json:"dateTimeText"`
	LocationText   string        `json:"locationText"`
	MeetingLink    string        `json:"meetingLink"`
	ConflictStatus string        `json:"conflictStatus"`
	ConflictHint   string        `json:"conflictHint,omitempty"`
	ICSFileName    string        `json:"icsFileName"`
	Attendees      []AttendeeDTO `json:"attendees"`
	RSVP           string        `json:"rsvp"`
}

type MailItemDTO struct {
	ID                  string              `json:"id"`
	ThreadID            string              `json:"threadId"`
	AccountID           string              `json:"accountId"`
	AccountTag          string              `json:"accountTag"`
	Provider            string              `json:"provider"`
	Folder              string              `json:"folder"`
	SenderName          string              `json:"senderName"`
	SenderEmail         string              `json:"senderEmail"`
	AvatarText          string              `json:"avatarText"`
	AvatarTone          string              `json:"avatarTone"`
	Recipients          string              `json:"recipients"`
	Cc                  string              `json:"cc,omitempty"`
	Subject             string              `json:"subject"`
	Snippet             string              `json:"snippet"`
	TimeText            string              `json:"timeText"`
	FullTimeText        string              `json:"fullTimeText"`
	ReceivedAtUnixMs    int64               `json:"receivedAtUnixMs"`
	Unread              bool                `json:"unread"`
	Starred             bool                `json:"starred"`
	Labels              []string            `json:"labels"`
	StatusBadge         string              `json:"statusBadge,omitempty"`
	AiSummarized        bool                `json:"aiSummarized,omitempty"`
	SnoozeUntil         string              `json:"snoozeUntil,omitempty"`
	ScheduledAt         string              `json:"scheduledAt,omitempty"`
	OutboxError         string              `json:"outboxError,omitempty"`
	HasRemoteImages     bool                `json:"hasRemoteImages,omitempty"`
	RemoteImagesAllowed bool                `json:"remoteImagesAllowed,omitempty"`
	SecurityWarning     *SecurityWarningDTO `json:"securityWarning,omitempty"`
	MeetingInvite       *MeetingInviteDTO   `json:"meetingInvite,omitempty"`
	Attachments         []AttachmentDTO     `json:"attachments"`
	Messages            []ThreadMessageDTO  `json:"messages"`
	RawHeaders          string              `json:"rawHeaders,omitempty"`
}

type MailSearchQuery struct {
	Keyword       string   `json:"keyword"`
	AccountIDs    []string `json:"accountIds,omitempty"`
	Folder        string   `json:"folder"`
	Tab           string   `json:"tab"`
	From          string   `json:"from,omitempty"`
	To            string   `json:"to,omitempty"`
	HasAttachment *bool    `json:"hasAttachment,omitempty"`
	LabelIDs      []string `json:"labelIds,omitempty"`
	DateFrom      int64    `json:"dateFrom,omitempty"`
	DateTo        int64    `json:"dateTo,omitempty"`
	Cursor        string   `json:"cursor,omitempty"`
	Limit         int      `json:"limit,omitempty"`
}

type MessageListPage struct {
	Items            []MailItemDTO `json:"items"`
	NextCursor       string        `json:"nextCursor,omitempty"`
	TotalCount       int           `json:"totalCount"`
	HasRemoteMore    bool          `json:"hasRemoteMore"`
	RemoteTotalCount int           `json:"remoteTotalCount,omitempty"`
}

type FolderCounts struct {
	Counts map[string]int `json:"counts"`
	Totals map[string]int `json:"totals"`
}
