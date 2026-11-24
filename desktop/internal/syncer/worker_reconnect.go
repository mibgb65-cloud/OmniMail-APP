package syncer

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"

	"omnimail/internal/accounts"
	"omnimail/internal/mailproto"
	"omnimail/internal/security"
)

type imapReconnectFunc func() (*imapclient.Client, error)

type syncMailboxOptions struct {
	Ctx        context.Context
	ProfileDir string
	Reconnect  imapReconnectFunc
}

// isConnectionLevelError 判断错误是否属于底层连接断开、EOF、超时或协议状态损坏。
func isConnectionLevelError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) || errors.Is(err, net.ErrClosed) {
		return true
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		return true
	}
	low := strings.ToLower(err.Error())
	for _, needle := range []string{
		"imapclient: connection closed",
		"connection closed",
		"use of closed network connection",
		"broken pipe",
		"connection reset",
		"wsarecv",
		"wsasend",
		"unexpected eof",
		"i/o timeout",
		"client is closed",
	} {
		if strings.Contains(low, needle) {
			return true
		}
	}
	return false
}

func closeIMAPQuietly(cli *imapclient.Client, broken bool) {
	if cli == nil {
		return
	}
	if !broken {
		_ = cli.Logout().Wait()
	}
	_ = cli.Close()
}

func reconnectAndSelectMailbox(
	cur *imapclient.Client,
	reconnect imapReconnectFunc,
	remoteName string,
) (*imapclient.Client, *imap.SelectData, error) {
	closeIMAPQuietly(cur, true)
	if reconnect == nil {
		return nil, nil, errors.New("未配置 IMAP 重连回调")
	}
	nextCli, err := reconnect()
	if err != nil {
		return nil, nil, err
	}
	sel, err := nextCli.Select(remoteName, &imap.SelectOptions{ReadOnly: true}).Wait()
	if err != nil {
		closeIMAPQuietly(nextCli, isConnectionLevelError(err))
		return nil, nil, err
	}
	return nextCli, sel, nil
}

func formatSanitizedFolderError(remoteName string, err error) string {
	if err == nil {
		return ""
	}
	detail := strings.TrimSpace(security.RedactSensitive(err.Error()))
	detail = strings.Join(strings.Fields(detail), " ")
	if utf8.RuneCountInString(detail) > 160 {
		runes := []rune(detail)
		detail = string(runes[:160]) + "…"
	}
	if remoteName == "" {
		return detail
	}
	return fmt.Sprintf("%s 同步失败: %s", remoteName, detail)
}

func summarizeFolderErrors(errs []string) string {
	if len(errs) == 0 {
		return ""
	}
	if len(errs) == 1 {
		return errs[0]
	}
	return fmt.Sprintf("%s（共 %d 个文件夹受阻）", errs[0], len(errs))
}

func (w *SyncWorker) syncBoxesWithReconnect(
	workConn *imapclient.Client,
	accDTO accounts.EmailAccountDTO,
	boxes []mailproto.DiscoveredMailbox,
	reconnect imapReconnectFunc,
) ([]string, bool, bool, []string, *imapclient.Client) {
	var allAdded, folderErrors []string
	var syncedBox, failedBox, syncingOtherFolders bool
	opts := syncMailboxOptions{Ctx: w.ctx, ProfileDir: w.sess.ProfileDir, Reconnect: reconnect}

	for _, mb := range boxes {
		if mb.NoSelect || mb.LocalFolder == "custom" {
			continue
		}
		if w.ctx != nil && w.ctx.Err() != nil {
			break
		}
		if mb.LocalFolder != "inbox" && !syncingOtherFolders {
			w.emitSyncProgress("syncing", "正在同步其他邮件文件夹…")
			syncingOtherFolders = true
		}
		mbStart := time.Now()
		if workConn == nil {
			fresh, rErr := reconnect()
			if rErr != nil {
				failedBox = true
				folderErrors = append(folderErrors, formatSanitizedFolderError(mb.RemoteName, rErr))
				AppendSyncLog(w.sess.DB, w.sess.ProfileDir, w.accountID, "IMAP", "error", "folder-sync", time.Since(mbStart).Milliseconds(), fmt.Sprintf("文件夹 %s 同步失败", mb.RemoteName), rErr.Error())
				continue
			}
			workConn = fresh
		}
		added, nextConn, mbErr := syncSingleMailboxWithOptions(workConn, w.sess.DB, w.sess.Blobs, w.hooks, w.bus, accDTO, mb, opts)
		workConn = nextConn
		allAdded = append(allAdded, added...)
		if mbErr == nil {
			syncedBox = true
			continue
		}
		failedBox = true
		folderErrors = append(folderErrors, formatSanitizedFolderError(mb.RemoteName, mbErr))
		AppendSyncLog(w.sess.DB, w.sess.ProfileDir, w.accountID, "IMAP", "error", "folder-sync", time.Since(mbStart).Milliseconds(), fmt.Sprintf("文件夹 %s 同步失败", mb.RemoteName), mbErr.Error())
		if isConnectionLevelError(mbErr) {
			closeIMAPQuietly(workConn, true)
			workConn = nil
			if reconnect != nil {
				if fresh, rErr := reconnect(); rErr == nil {
					workConn = fresh
				} else {
					AppendSyncLog(w.sess.DB, w.sess.ProfileDir, w.accountID, "IMAP", "error", "reconnect", 0, "文件夹同步断连后重连失败", rErr.Error())
				}
			}
		}
	}
	return allAdded, syncedBox, failedBox, folderErrors, workConn
}
