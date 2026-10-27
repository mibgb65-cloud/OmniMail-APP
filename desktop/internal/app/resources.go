package app

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync"

	"omnimail/desktop/internal/config"
	"omnimail/desktop/internal/logger"
	"omnimail/desktop/internal/repository"
)

type resources struct {
	log      *slog.Logger
	storage  *repository.Store
	logFile  io.Closer
	once     sync.Once
	closeErr error
}

func openResources(ctx context.Context, cfg config.Config) (*resources, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	log, logFile, err := logger.New(cfg.DataDir, cfg.LogLevel)
	if err != nil {
		return nil, err
	}
	storage, err := repository.Open(ctx, cfg.DataDir)
	if err != nil {
		return nil, errors.Join(err, logFile.Close())
	}
	return &resources{log: log, storage: storage, logFile: logFile}, nil
}

func (r *resources) shutdown() {
	r.once.Do(func() {
		// Wails 回调不能返回错误，先保存关闭结果，由 Run 的 defer 统一交付给入口。
		r.log.Info("应用关闭")
		r.closeErr = errors.Join(r.storage.Close(), r.logFile.Close())
	})
}

func (r *resources) Close() error {
	r.shutdown()
	return r.closeErr
}
