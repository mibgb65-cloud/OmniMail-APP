package events

const MailTranslationBatch = "omnimail:mail:translation-batch"

type MailTranslationRequestKey struct {
	ProfileID string `json:"profileId"`
	MailID    string `json:"mailId"`
	RequestID string `json:"requestId"`
}

type MailTranslationBatchPayload struct {
	MailTranslationRequestKey
	Source           string            `json:"source"`
	Subject          string            `json:"subject,omitempty"`
	Segments         map[string]string `json:"segments"`
	CompletedBatches int               `json:"completedBatches"`
	TotalBatches     int               `json:"totalBatches"`
}
