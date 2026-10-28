package app

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync"

	"omnimail/desktop/internal/config"
	"omnimail/desktop/internal/logger"
	"omnimail/desktop/internal/mailnet"
	"omnimail/desktop/internal/platform"
	"omnimail/desktop/internal/repository"
	"omnimail/desktop/internal/service"
)

type resources struct {
	log      *slog.Logger
	storage  *repository.Store
	mail     *service.Mail
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
	mail := service.NewMail(storage, platform.NewCredentials(), mailnet.New(), log)
	return &resources{log: log, storage: storage, logFile: logFile, mail: mail}, nil
}

func (r *resources) shutdown() {
	r.once.Do(func() {
		// Wails 回调不能返回错误，先保存关闭结果，由 Run 的 defer 统一交付给入口。
		r.log.Info("应用关闭")
		mailError := r.mail.Close()
		r.closeErr = errors.Join(mailError, r.storage.Close(), r.logFile.Close())
	})
}

func (r *resources) Close() error {
	r.shutdown()
	return r.closeErr
}
