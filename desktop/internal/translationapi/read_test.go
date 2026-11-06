package translationapi

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"
)

func TestTranslateResponseBodyDeadline(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"model":`))
		w.(http.Flusher).Flush()
		<-r.Context().Done()
	}))
	defer server.Close()
	ctx, cancel := context.WithTimeout(t.Context(), 100*time.Millisecond)
	defer cancel()
	_, err := (&Client{http: server.Client(), endpoint: server.URL}).Translate(ctx, domain.TranslatedText{Body: "synthetic"}, "zh")
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("响应体超时应保留 deadline 分类，实际 %v", err)
	}
}

func TestTranslateBrokenResponseBodyIsUnavailable(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", "1000")
		w.Write([]byte(`{"model":`))
	}))
	defer server.Close()
	_, err := (&Client{http: server.Client(), endpoint: server.URL}).Translate(t.Context(), domain.TranslatedText{Body: "synthetic"}, "zh")
	if !errors.Is(err, domain.ErrTranslationUnavailable) {
		t.Fatalf("断流不应误报为格式错误，实际 %v", err)
	}
}
