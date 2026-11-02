package domain

import "context"

const (
	CloseAsk        = "ask"
	CloseQuit       = "quit"
	CloseBackground = "background"
)

func ValidCloseMode(mode string) bool {
	return mode == CloseAsk || mode == CloseQuit || mode == CloseBackground
}

type ClosePreferences interface {
	Load(context.Context) (string, error)
	Save(context.Context, string) error
}
