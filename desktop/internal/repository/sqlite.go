package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"unicode"
	"unicode/utf8"

	_ "modernc.org/sqlite"
)

const applicationID = 0x4f4d4e49

var (
	ErrDatabaseIdentity = errors.New("数据库不属于 OmniMail，未执行迁移")
	ErrSchemaVersion    = errors.New("数据库版本或迁移校验不匹配")
)

type Store struct {
	db *sql.DB
}

// Open 只接收本机数据目录，不接受外部 SQLite URI 或连接参数。
func Open(ctx context.Context, dataDir string) (*Store, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	clean := filepath.Clean(dataDir)
	if len(dataDir) > 4096 || !utf8.ValidString(dataDir) ||
		strings.ContainsFunc(dataDir, unicode.IsControl) || !filepath.IsAbs(clean) ||
		filepath.Dir(clean) == clean || strings.HasPrefix(clean, `\\`) {
		return nil, errors.New("数据库目录必须是普通本地绝对路径，且不能是磁盘根目录")
	}
	if err := os.MkdirAll(clean, 0o700); err != nil {
		return nil, storageError("创建数据库目录", err)
	}
	path := filepath.Join(clean, "omnimail.db")
	db, err := sql.Open("sqlite", databaseURI(path))
	if err != nil {
		return nil, storageError("打开数据库", err)
	}
	// 账号配置的数据量很小；先用单连接保证写入串行，事务中禁止等待网络或钥匙串。
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	if err := initialize(ctx, db, clean); err != nil {
		return nil, errors.Join(err, storageError("关闭初始化失败的数据库", db.Close()))
	}
	return &Store{db: db}, nil
}

func databaseURI(path string) string {
	path = filepath.ToSlash(path)
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	uri := url.URL{Scheme: "file", Path: path}
	query := url.Values{"_txlock": {"immediate"}}
	// 连接被驱动重新创建时也必须启用外键，不能只对第一次连接执行 PRAGMA。
	for _, pragma := range []string{"foreign_keys(1)", "busy_timeout(5000)", "synchronous(NORMAL)"} {
		query.Add("_pragma", pragma)
	}
	uri.RawQuery = query.Encode()
	return uri.String()
}

func initialize(ctx context.Context, db *sql.DB, dataDir string) error {
	var identity, tables int
	if err := db.QueryRowContext(ctx,
		`SELECT (SELECT application_id FROM pragma_application_id),
		(SELECT count(*) FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%')`).Scan(&identity, &tables); err != nil {
		return storageError("读取数据库身份和结构", err)
	}
	if identity != applicationID && (identity != 0 || tables != 0) {
		return ErrDatabaseIdentity
	}
	if identity == applicationID {
		var history int
		if err := db.QueryRowContext(ctx,
			"SELECT count(*) FROM sqlite_schema WHERE name='schema_migration' AND type='table'").Scan(&history); err != nil {
			return storageError("检查已知数据库结构", err)
		}
		if history != 1 {
			return schemaError(0)
		}
	}
	var mode string
	if err := db.QueryRowContext(ctx, "PRAGMA journal_mode=WAL").Scan(&mode); err != nil {
		return storageError("启用数据库 WAL", err)
	}
	if mode != "wal" {
		return errors.New("数据库未能启用 WAL")
	}
	return migrate(ctx, db, dataDir, migrationFiles)
}

// Close 关闭最后一个连接时由 SQLite 完成 WAL 收尾；关闭错误交由应用生命周期处理。
func (s *Store) Close() error {
	return storageError("关闭数据库", s.db.Close())
}

type operationError struct {
	operation string
	cause     error
}

func (e *operationError) Error() string { return e.operation + "失败" }
func (e *operationError) Unwrap() error { return e.cause }

func storageError(operation string, err error) error {
	if err == nil {
		return nil
	}
	// 保留 errors.Is/As 的诊断能力，但不把驱动错误中的路径、SQL 或参数暴露到日志与界面。
	return &operationError{operation: operation, cause: err}
}

func rollback(tx *sql.Tx, result *error) {
	if err := tx.Rollback(); err != nil && !errors.Is(err, sql.ErrTxDone) {
		*result = errors.Join(*result, storageError("回滚数据库事务", err))
	}
}

func schemaError(version int) error {
	return fmt.Errorf("迁移版本 %d: %w", version, ErrSchemaVersion)
}
