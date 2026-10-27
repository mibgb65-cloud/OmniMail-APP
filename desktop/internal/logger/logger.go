package logger

import (
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

func New(dataDir string, level slog.Level) (*slog.Logger, io.Closer, error) {
	writer := &dailyWriter{dir: filepath.Join(dataDir, "logs"), now: time.Now}
	if err := os.MkdirAll(writer.dir, 0o700); err != nil {
		return nil, nil, fmt.Errorf("无法创建日志目录: %w", err)
	}
	if err := writer.open(); err != nil {
		return nil, nil, err
	}
	emailPattern := regexp.MustCompile(`(?i)[a-z0-9.!#$%&'*+/=?^_` + "`" + `{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}`)
	handler := slog.NewJSONHandler(writer, &slog.HandlerOptions{
		Level: level,
		ReplaceAttr: func(_ []string, attr slog.Attr) slog.Attr {
			// slog 将级别表示为 Any；保留内建级别，其他不透明对象仍默认脱敏。
			if attr.Key == slog.LevelKey && attr.Value.Kind() == slog.KindAny {
				if value, ok := attr.Value.Any().(slog.Level); ok {
					return slog.String(attr.Key, value.String())
				}
			}
			key := strings.ToLower(attr.Key)
			for _, sensitive := range []string{"password", "token", "secret", "email", "authorization", "cookie", "credential", "body", "attachment", "content"} {
				if strings.Contains(key, sensitive) {
					return slog.String(attr.Key, "[已脱敏]")
				}
			}
			// 任意对象可能包含未标注的嵌套凭据，默认不序列化；结构化分组仍逐字段检查。
			if attr.Value.Kind() == slog.KindAny {
				return slog.String(attr.Key, "[已脱敏]")
			}
			if attr.Value.Kind() == slog.KindString {
				return slog.String(attr.Key, emailPattern.ReplaceAllString(attr.Value.String(), "[邮箱已脱敏]"))
			}
			return attr
		},
	})
	return slog.New(handler), writer, nil
}

type dailyWriter struct {
	mu     sync.Mutex
	dir    string
	day    string
	file   *os.File
	now    func() time.Time
	closed bool
}

func (w *dailyWriter) open() error {
	day := w.now().Format("2006-01-02")
	if w.file != nil {
		if err := w.file.Close(); err != nil {
			return fmt.Errorf("无法轮转日志: %w", err)
		}
		w.file = nil
	}
	file, err := os.OpenFile(filepath.Join(w.dir, "app-"+day+".log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return fmt.Errorf("无法打开日志文件: %w", err)
	}
	w.file, w.day = file, day
	return nil
}

func (w *dailyWriter) Write(data []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.closed {
		return 0, os.ErrClosed
	}
	if w.file == nil || w.day != w.now().Format("2006-01-02") {
		if err := w.open(); err != nil {
			return 0, err
		}
	}
	return w.file.Write(data)
}

func (w *dailyWriter) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.closed {
		return nil
	}
	w.closed = true
	if w.file == nil {
		return nil
	}
	return w.file.Close()
}
