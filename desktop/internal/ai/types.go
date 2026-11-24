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
	SummaryTitle        string           `json:"summaryTitle"`
	Summary             string           `json:"summary"`
	Deadlines           []AiDeadlineItem `json:"deadlines"`
	DraftTag            string           `json:"draftTag"`
	DraftReply          string           `json:"draftReply"`
	SummaryLanguage     string           `json:"summaryLanguage,omitempty"`
	SourceLanguage      string           `json:"sourceLanguage,omitempty"`
	DraftLanguage       string           `json:"draftLanguage,omitempty"`
	DraftTargetLanguage string           `json:"draftTargetLanguage,omitempty"`
	DraftTone           string           `json:"draftTone,omitempty"`
	Cached              bool             `json:"cached,omitempty"`
	ModelName           string           `json:"modelName,omitempty"`
}

type MailSummaryOptions struct {
	RequestID      string `json:"requestId"`
	SourceLanguage string `json:"sourceLanguage"`
	AutoTriggered  bool   `json:"autoTriggered"`
}

type MailDraftOptions struct {
	RequestID      string `json:"requestId"`
	SourceLanguage string `json:"sourceLanguage"`
	TargetLanguage string `json:"targetLanguage"`
	Tone           string `json:"tone"`
}

type AiChatTurn struct {
	ID        string `json:"id"`
	Role      string `json:"role"`
	Content   string `json:"content"`
	Timestamp string `json:"timestamp"`
}

type AskMailRequest struct {
	RequestID        string `json:"requestId,omitempty"`
	MailID           string `json:"mailId"`
	Question         string `json:"question"`
	ConsentConfirmed bool   `json:"consentConfirmed"`
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
