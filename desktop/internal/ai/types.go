package ai

type SaveConfigRequest struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
	BaseURL  string `json:"baseUrl"`
	APIKey   string `json:"apiKey,omitempty"`
}

type ModelsRequest struct {
	Provider string `json:"provider"`
	BaseURL  string `json:"baseUrl"`
	APIKey   string `json:"apiKey,omitempty"`
}

type TestResult struct {
	OK        bool   `json:"ok"`
	Status    string `json:"status"`
	LatencyMs int64  `json:"latencyMs"`
	Message   string `json:"message"`
}

type AiDeadlineItem struct {
	Label    string `json:"label"`
	TimeText string `json:"timeText"`
	Urgent   bool   `json:"urgent,omitempty"`
}

type AiMailInsight struct {
	SummaryTitle string           `json:"summaryTitle"`
	Summary      string           `json:"summary"`
	Deadlines    []AiDeadlineItem `json:"deadlines"`
	DraftTag     string           `json:"draftTag"`
	DraftReply   string           `json:"draftReply"`
	Cached       bool             `json:"cached,omitempty"`
	ModelName    string           `json:"modelName,omitempty"`
}

type AiChatTurn struct {
	ID        string `json:"id"`
	Role      string `json:"role"`
	Content   string `json:"content"`
	Timestamp string `json:"timestamp"`
}

type AskMailRequest struct {
	MailID           string       `json:"mailId"`
	Question         string       `json:"question"`
	History          []AiChatTurn `json:"history,omitempty"`
	ConsentConfirmed bool         `json:"consentConfirmed"`
}

type ComposeAssistRequest struct {
	DraftID          string `json:"draftId,omitempty"`
	Action           string `json:"action"`
	Tone             string `json:"tone"`
	Subject          string `json:"subject,omitempty"`
	Body             string `json:"body"`
	Prompt           string `json:"prompt,omitempty"`
	ConsentConfirmed bool   `json:"consentConfirmed"`
}

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}
