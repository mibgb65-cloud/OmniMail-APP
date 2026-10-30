package mailnet

import (
	"bufio"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"net"
	"strings"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"
)

// 只使用本地 TLS 和合成响应，不输出客户端命令，避免把登录内容带入测试日志。
// 握手、故障脚本和清理集中在同一测试夹具，便于核对每个合成会话的完整生命周期。
func failureSession(t *testing.T, ctx context.Context, operation, response string) (domain.MailSession, <-chan struct{}) {
	t.Helper()
	config, roots := testTLS(t)
	listener, err := tls.Listen("tcp", "127.0.0.1:0", config)
	if err != nil {
		t.Fatal(err)
	}
	started, done := make(chan struct{}), make(chan struct{})
	go func() {
		defer close(done)
		conn, err := listener.Accept()
		if err != nil {
			return
		}
		defer func() {
			if err := conn.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
				// 故障用例会主动中断 TLS，关闭通知可能遇到已断开的对端，不输出原始错误。
				t.Log("故障脚本连接关闭返回网络结束信号")
			}
		}()
		if err := conn.SetDeadline(time.Now().Add(5 * time.Second)); err != nil {
			t.Error("本地协议测试连接无法设置期限")
			return
		}
		write := func(value string) bool {
			_, err := io.WriteString(conn, value)
			return err == nil
		}
		if !write("* OK [CAPABILITY IMAP4rev1] local fixture\r\n") {
			return
		}
		reader := bufio.NewReader(conn)
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				return
			}
			fields := strings.Fields(line)
			if len(fields) < 2 {
				return
			}
			tag, command := fields[0], strings.ToUpper(strings.Join(fields[1:], " "))
			target := strings.HasPrefix(command, operation+" ")
			if operation == "SELECT" {
				target = strings.HasPrefix(command, "EXAMINE ")
			}
			if target {
				select {
				case <-started:
				default:
					close(started)
				}
				switch response {
				case "drop":
					return
				case "hold":
					<-ctx.Done()
					return
				case "bad":
					if !write(tag + " BAD command rejected\r\n") {
						return
					}
				case "malformed":
					if write("* INVALID_RESPONSE\r\n") {
						if _, err := reader.ReadString('\n'); err == nil {
							t.Error("非法协议响应后客户端没有关闭连接")
						}
					}
					return
				case "partial":
					write("* 1 FETCH (UID 1 FLAGS () INTERNALDATE \"01-Jan-2026 00:00:00 +0000\" RFC822.SIZE 8 ENVELOPE (NIL \"fixture\" NIL NIL NIL NIL NIL NIL NIL NIL))\r\n")
					return
				case "missing-envelope":
					if !write("* 1 FETCH (UID 1 FLAGS ())\r\n" + tag + " OK fetched\r\n") {
						return
					}
				case "dropped-live-header", "vanished-header":
					if !write(tag + " OK fetched\r\n") {
						return
					}
				case "fragmented":
					if strings.Contains(command, "FLAGS") {
						if !write("* 1 FETCH (UID 1 FLAGS (\\Seen))\r\n" + tag + " OK fetched\r\n") {
							return
						}
					} else if !write("* 1 FETCH (UID 1 INTERNALDATE \"01-Jan-2026 00:00:00 +0000\" RFC822.SIZE 8 ENVELOPE (NIL \"fixture\" NIL NIL NIL NIL NIL NIL NIL NIL))\r\n" + tag + " OK fetched\r\n") {
						return
					}
				case "no-flags":
					if !write("* 1 FETCH (UID 1 INTERNALDATE \"01-Jan-2026 00:00:00 +0000\" RFC822.SIZE 8 ENVELOPE (NIL \"fixture\" NIL NIL NIL NIL NIL NIL NIL NIL))\r\n" + tag + " OK fetched\r\n") {
						return
					}
				case "broken-envelope":
					if strings.Contains(command, "ENVELOPE") {
						write("* 1 FETCH (UID 1 FLAGS (\\Seen) ENVELOPE INVALID)\r\n")
						return
					}
					raw := "From: sender@example.invalid\r\nTo: person@example.invalid\r\n" +
						"Subject: fixture\r\nMessage-ID: <fixture@example.invalid>\r\n\r\n"
					if !write(fmt.Sprintf("* 1 FETCH (UID 1 FLAGS (\\Seen) INTERNALDATE \"01-Jan-2026 00:00:00 +0000\" RFC822.SIZE 8 BODY[HEADER] {%d}\r\n%s)\r\n%s OK fetched\r\n", len(raw), raw, tag)) {
						return
					}
				case "unexpected-body":
					raw := strings.Repeat("x", 32<<10)
					if !write(fmt.Sprintf("* 1 FETCH (UID 1 BODY[] {%d}\r\n%s)\r\n%s OK fetched\r\n", len(raw), raw, tag)) {
						return
					}
				case "truncated":
					write("* 1 FETCH (UID 1 BODY[] {100}\r\nFrom: preview@example.invalid\r\n")
					return
				case "oversize":
					write(fmt.Sprintf("* 1 FETCH (UID 1 BODY[] {%d}\r\nx", maxRawBytes+1))
				case "invalid-body", "invalid-body-large", "sink-error":
					raw := "invalid header without colon\r\n\r\n"
					if response == "invalid-body-large" {
						raw += strings.Repeat("x", 64<<10)
					} else if response == "sink-error" {
						raw = "MIME-Version: 1.0\r\nContent-Type: application/octet-stream\r\n" +
							"Content-Disposition: attachment; filename=\"fixture.bin\"\r\n\r\n" + strings.Repeat("x", 32<<10)
					}
					if !write(fmt.Sprintf("* 1 FETCH (UID 1 BODY[] {%d}\r\n%s)\r\n%s OK fetched\r\n", len(raw), raw, tag)) {
						return
					}
				}
				continue
			}
			switch {
			case strings.HasPrefix(command, "LOGIN "):
				if !write(tag + " OK authenticated\r\n") {
					return
				}
			case command == "CAPABILITY":
				if !write("* CAPABILITY IMAP4rev1\r\n" + tag + " OK capabilities\r\n") {
					return
				}
			case strings.HasPrefix(command, "UID SEARCH "):
				result := "* SEARCH 1\r\n"
				if response == "vanished-header" && strings.HasPrefix(command, "UID SEARCH UID ") {
					result = "* SEARCH\r\n"
				}
				if !write(result + tag + " OK searched\r\n") {
					return
				}
			case strings.HasPrefix(command, "EXAMINE "):
				if !write(fmt.Sprintf("* 1 EXISTS\r\n* OK [UIDVALIDITY 7] valid\r\n* OK [UIDNEXT 2] next\r\n%s OK [READ-ONLY] selected\r\n", tag)) {
					return
				}
			default:
				if !write(tag + " BAD unexpected test command\r\n") {
					return
				}
			}
		}
	}()
	t.Cleanup(func() {
		if err := listener.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
			t.Error("本地协议测试监听清理失败")
		}
		select {
		case <-done:
		case <-time.After(6 * time.Second):
			t.Error("本地协议测试连接未退出")
		}
	})
	transport := &Transport{roots: roots}
	value, err := transport.Connect(ctx, testEndpoint(t, listener.Addr().String(), domain.TLSImplicit), []byte("test-password"))
	if err != nil {
		t.Fatal("本地协议测试连接失败")
	}
	t.Cleanup(func() {
		closed := make(chan error, 1)
		go func() { closed <- value.Close() }()
		select {
		case err := <-closed:
			if err != nil {
				// 故障会话 Close 可重复返回主断言已验证的解析/连接错误；只记安全说明，不记响应原文。
				t.Log("故障会话清理返回连接/解析结束信号")
			}
		case <-time.After(2 * time.Second):
			t.Error("本地 IMAP 会话清理被未消费的 literal 卡住")
		}
	})
	return value, started
}

func TestIMAPHeaderFallbackKeepsRequiredFieldsAndRejectsUnexpectedBodies(t *testing.T) {
	for _, response := range []string{"no-flags", "unexpected-body"} {
		t.Run(response, func(t *testing.T) {
			value, _ := failureSession(t, t.Context(), "UID FETCH", response)
			if _, _, err := value.Select("INBOX"); err != nil {
				t.Fatal("本地测试文件夹无法选择")
			}
			messages, err := value.Headers(1, 1)
			if !errors.Is(err, domain.ErrProtocol) || len(messages) != 0 {
				t.Fatal("补取放宽了字段/响应限制")
			}
		})
	}
}

func TestIMAPDecodeFailureCleanupIsBoundedAndKeepsItsCause(t *testing.T) {
	sinkFailure := errors.New("SINK_STORAGE_FAILURE")
	for _, response := range []string{"invalid-body", "invalid-body-large", "oversize", "sink-error"} {
		t.Run(response, func(t *testing.T) {
			value, _ := failureSession(t, t.Context(), "UID FETCH", response)
			if _, _, err := value.Select("INBOX"); err != nil {
				t.Fatal("本地测试文件夹无法选择")
			}
			result := make(chan error, 1)
			go func() {
				_, err := value.Body(1, func(string, string, io.Reader) (domain.DecodedAttachment, error) {
					return domain.DecodedAttachment{}, sinkFailure
				})
				result <- err
			}()
			expected := domain.ErrProtocol
			if response == "oversize" {
				expected = domain.ErrTooLarge
			} else if response == "sink-error" {
				expected = sinkFailure
			}
			select {
			case err := <-result:
				if !errors.Is(err, expected) {
					t.Fatalf("正文失败原因被覆盖：%v", err)
				}
			case <-time.After(2 * time.Second):
				t.Fatal("正文解析/尺寸失败后关闭流程卡住")
			}
		})
	}
}

func TestIMAPInterruptedFetchCannotReturnPartialSuccess(t *testing.T) {
	for _, response := range []string{"partial", "truncated"} {
		t.Run(response, func(t *testing.T) {
			value, _ := failureSession(t, t.Context(), "UID FETCH", response)
			if _, _, err := value.Select("INBOX"); err != nil {
				t.Fatal("本地测试文件夹无法选择")
			}
			if response == "partial" {
				messages, err := value.Headers(1, 1)
				if !errors.Is(err, domain.ErrNetwork) || len(messages) != 0 {
					t.Fatal("未收到整批完成确认时返回了部分成功")
				}
			} else if _, err := value.Body(1, nil); !errors.Is(err, domain.ErrNetwork) {
				t.Fatalf("正文传输中断被错误归类：%v", err)
			}
		})
	}
}

func TestIMAPDisconnectIsNotReportedAsInvalidMail(t *testing.T) {
	for _, operation := range []string{"LIST", "SELECT", "UID SEARCH", "UID FETCH", "BODY"} {
		t.Run(operation, func(t *testing.T) {
			command := operation
			if operation == "BODY" {
				command = "UID FETCH"
			}
			value, _ := failureSession(t, t.Context(), command, "drop")
			var err error
			switch operation {
			case "LIST":
				_, err = value.Mailboxes()
			case "SELECT":
				_, _, err = value.Select("INBOX")
			default:
				if _, _, err := value.Select("INBOX"); err != nil {
					t.Fatal("本地测试文件夹无法选择")
				}
				switch operation {
				case "UID SEARCH":
					_, _, err = value.LocateUID(1)
				case "UID FETCH":
					_, err = value.Headers(1, 1)
				case "BODY":
					_, err = value.Body(1, nil)
				}
			}
			if !errors.Is(err, domain.ErrNetwork) {
				t.Fatalf("连接中断应分类为网络失败，实际安全错误：%v", err)
			}
		})
	}
}

func TestIMAPCancellationAndDeadlineKeepTheirMeaning(t *testing.T) {
	for _, deadline := range []bool{false, true} {
		t.Run(fmt.Sprint(deadline), func(t *testing.T) {
			ctx, cancel := context.WithCancel(t.Context())
			if deadline {
				cancel()
				ctx, cancel = context.WithTimeout(t.Context(), 2*time.Second)
			}
			defer cancel()
			value, started := failureSession(t, ctx, "LIST", "hold")
			result := make(chan error, 1)
			go func() { _, err := value.Mailboxes(); result <- err }()
			select {
			case <-started:
			case <-time.After(time.Second):
				t.Fatal("本地 LIST 未开始")
			}
			if !deadline {
				cancel()
			}
			expected := context.Canceled
			if deadline {
				expected = context.DeadlineExceeded
			}
			select {
			case err := <-result:
				if !errors.Is(err, expected) {
					t.Fatalf("取消/超时语义丢失：%v", err)
				}
			case <-time.After(3 * time.Second):
				t.Fatal("取消/超时后命令未退出")
			}
		})
	}
}

func TestIMAPInvalidResponsesRemainProtocolErrors(t *testing.T) {
	for _, response := range []string{"bad", "malformed"} {
		t.Run(response, func(t *testing.T) {
			value, _ := failureSession(t, t.Context(), "LIST", response)
			if _, err := value.Mailboxes(); !errors.Is(err, domain.ErrProtocol) {
				t.Fatalf("真正协议错误被掩盖：%v", err)
			}
		})
	}
}

func TestIMAPReadBudgetRemainsAnExplicitSizeLimit(t *testing.T) {
	conn := &limitedConn{remaining: 0}
	if _, err := conn.Read(make([]byte, 1)); !errors.Is(err, domain.ErrTooLarge) {
		t.Fatalf("读取预算耗尽不能伪装成网络/格式故障：%v", err)
	}
}

func TestIMAPProtocolReasonIsSafeAndDoesNotAcceptIncompleteHeaders(t *testing.T) {
	value, _ := failureSession(t, t.Context(), "UID FETCH", "missing-envelope")
	if _, _, err := value.Select("INBOX"); err != nil {
		t.Fatal("本地测试文件夹无法选择")
	}
	messages, err := value.Headers(1, 1)
	var diagnostic interface{ DiagnosticCode() string }
	if !errors.Is(err, domain.ErrProtocol) || len(messages) != 0 || !errors.As(err, &diagnostic) {
		t.Fatal("不完整响应被接受或缺失安全诊断")
	}
	if diagnostic.DiagnosticCode() != "incomplete_headers" || err.Error() != "MAIL_PROTOCOL_FAILED" {
		t.Fatal("诊断原因不正确或错误文本包含原文")
	}
}

func TestIMAPMetadataCanBeCompletedWithoutDroppingFlags(t *testing.T) {
	value, _ := failureSession(t, t.Context(), "UID FETCH", "fragmented")
	if _, _, err := value.Select("INBOX"); err != nil {
		t.Fatal("本地测试文件夹无法选择")
	}
	messages, err := value.Headers(1, 1)
	if err != nil || len(messages) != 1 || messages[0].Subject != "fixture" || !messages[0].Read ||
		messages[0].Size != 8 || messages[0].ReceivedAt <= 0 {
		t.Fatalf("分片元数据未完整合并或原 FLAGS 丢失：%v", err)
	}
}

func TestIMAPHeaderLiteralAvoidsBrokenEnvelopeParsing(t *testing.T) {
	value, _ := failureSession(t, t.Context(), "UID FETCH", "broken-envelope")
	if _, _, err := value.Select("INBOX"); err != nil {
		t.Fatal("本地测试文件夹无法选择")
	}
	messages, err := value.Headers(1, 1)
	if err != nil || len(messages) != 1 || messages[0].Subject != "fixture" || !messages[0].Read ||
		messages[0].From != "sender@example.invalid" || messages[0].MessageID != "fixture@example.invalid" {
		t.Fatalf("无法通过标准只读头部请求获取元数据：%v", err)
	}
}

func TestIMAPMissingLiveUIDIsNotTreatedAsRemoteDeletion(t *testing.T) {
	for _, response := range []string{"dropped-live-header", "vanished-header"} {
		t.Run(response, func(t *testing.T) {
			value, _ := failureSession(t, t.Context(), "UID FETCH", response)
			if _, _, err := value.Select("INBOX"); err != nil {
				t.Fatal("本地测试文件夹无法选择")
			}
			if _, found, err := value.LocateUID(1); err != nil || !found {
				t.Fatal("本地 UID 快照未建立")
			}
			messages, err := value.Headers(1, 1)
			if response == "dropped-live-header" {
				if !errors.Is(err, domain.ErrProtocol) || len(messages) != 0 {
					t.Fatal("仍存活 UID 的丢失响应被接受为远端删除")
				}
			} else if err != nil || len(messages) != 0 {
				t.Fatal("已确认远端删除的 UID 未正常对账")
			}
		})
	}
}
