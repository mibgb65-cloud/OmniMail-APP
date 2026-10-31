package mailnet

import (
	"bufio"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"net"
	"strconv"
	"strings"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"
)

type mailboxFixtureOptions struct {
	root, attributes           string
	gmail, rejectRoot          bool
	rejectChild                bool
	omitNext, omitValidity     bool
	statusNext, statusValidity uint32
	rejectStatus               bool
	searchUIDs                 string
}

// 集中处理 LIST/EXAMINE、真实 TLS 与有界清理，确保测试覆盖完整线路而非只测属性辅助函数。
// 只使用合成文件夹与账号，任何错误都不输出收到的命令或服务器原文。
func mailboxFixture(t *testing.T, options mailboxFixtureOptions) domain.MailSession {
	t.Helper()
	config, roots := testTLS(t)
	listener, err := tls.Listen("tcp", "127.0.0.1:0", config)
	if err != nil {
		t.Fatal("无法启动文件夹测试服务器")
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		conn, err := listener.Accept()
		if err != nil {
			return
		}
		defer releaseConnection(conn)
		if err := conn.SetDeadline(time.Now().Add(5 * time.Second)); err != nil {
			t.Error("文件夹测试无法设置期限")
			return
		}
		write := func(text string) bool {
			_, err := io.WriteString(conn, text+"\r\n")
			return err == nil
		}
		caps := "IMAP4rev1"
		if options.gmail {
			caps += " X-GM-EXT-1"
		}
		if !write("* OK [CAPABILITY " + caps + "] local fixture") {
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
			tag, command := fields[0], fields[1]
			switch command {
			case "CAPABILITY":
				if !write("* CAPABILITY " + caps + "\r\n" + tag + " OK capabilities") {
					return
				}
			case "LOGIN":
				if !write(tag + " OK [CAPABILITY " + caps + "] authenticated") {
					return
				}
			case "LIST":
				result := fmt.Sprintf("* LIST (\\HasNoChildren) \"/\" \"INBOX\"\r\n"+
					"* LIST (%s) \"/\" %q\r\n"+
					"* LIST (\\Sent \\HasNoChildren) \"/\" %q\r\n%s OK listed",
					options.attributes, options.root, options.root+"/Child", tag)
				if !write(result) {
					return
				}
			case "EXAMINE":
				name := strings.TrimSpace(strings.TrimPrefix(line, tag+" "+command))
				if strings.HasPrefix(name, "\"") {
					value, err := strconv.Unquote(name)
					if err != nil {
						t.Error("客户端生成了无效文件夹参数")
						return
					}
					name = value
				}
				switch {
				case name == options.root && options.rejectRoot:
					if !write(tag + " NO [NONEXISTENT] private-server-marker") {
						return
					}
				case name == options.root+"/Child" && options.rejectChild:
					if !write(tag + " NO [NOPERM] private-server-marker") {
						return
					}
				default:
					metadata := "* 0 EXISTS\r\n"
					if !options.omitValidity {
						metadata += "* OK [UIDVALIDITY 7] valid\r\n"
					}
					if !options.omitNext {
						metadata += "* OK [UIDNEXT 1] next\r\n"
					}
					if !write(metadata + tag + " OK [READ-ONLY] selected") {
						return
					}
				}
			case "STATUS":
				if options.rejectStatus {
					if !write(tag + " NO [NOPERM] private-server-marker") {
						return
					}
					continue
				}
				items := []string{}
				if options.statusValidity > 0 {
					items = append(items, fmt.Sprintf("UIDVALIDITY %d", options.statusValidity))
				}
				if options.statusNext > 0 {
					items = append(items, fmt.Sprintf("UIDNEXT %d", options.statusNext))
				}
				if !write("* STATUS \"INBOX\" (" + strings.Join(items, " ") + ")\r\n" + tag + " OK status") {
					return
				}
			case "UID":
				if len(fields) < 3 || fields[2] != "SEARCH" {
					t.Error("元数据测试收到非 SEARCH 命令")
					return
				}
				if !write(strings.TrimSpace("* SEARCH "+options.searchUIDs) + "\r\n" + tag + " OK searched") {
					return
				}
			default:
				t.Error("文件夹测试收到非预期命令")
				return
			}
		}
	}()
	value, err := (&Transport{roots: roots}).Connect(t.Context(),
		testEndpoint(t, listener.Addr().String(), domain.TLSImplicit), []byte("synthetic-password"))
	t.Cleanup(func() {
		if value != nil {
			if err := value.Close(); err != nil {
				t.Log("文件夹测试清理返回连接结束信号")
			}
		}
		if err := listener.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
			t.Error("文件夹测试监听清理失败")
		}
		select {
		case <-done:
		case <-time.After(6 * time.Second):
			t.Error("文件夹测试服务未退出")
		}
	})
	if err != nil {
		t.Fatal("无法连接合成文件夹服务器")
	}
	return value
}

func TestMailboxesExcludeOnlyUnselectableEntries(t *testing.T) {
	for _, test := range []struct {
		name     string
		options  mailboxFixtureOptions
		wantRoot bool
	}{
		{"gmail_container", mailboxFixtureOptions{root: "[Gmail]", attributes: "\\HasChildren", gmail: true, rejectRoot: true}, false},
		{"googlemail_container", mailboxFixtureOptions{root: "[Google Mail]", attributes: "\\HasChildren", gmail: true, rejectRoot: true}, false},
		{"noselect", mailboxFixtureOptions{root: "Parent", attributes: "\\Noselect \\HasChildren", rejectRoot: true}, false},
		{"noselect_case", mailboxFixtureOptions{root: "Parent", attributes: "\\nOsElEcT \\HasChildren", rejectRoot: true}, false},
		{"nonexistent", mailboxFixtureOptions{root: "Parent", attributes: "\\NonExistent \\HasChildren", rejectRoot: true}, false},
		{"real_parent", mailboxFixtureOptions{root: "Projects", attributes: "\\HasChildren"}, true},
		{"nongmail_same_name", mailboxFixtureOptions{root: "[Gmail]", attributes: "\\HasChildren"}, true},
	} {
		t.Run(test.name, func(t *testing.T) {
			value := mailboxFixture(t, test.options)
			boxes, err := value.Mailboxes()
			if err != nil {
				t.Fatal("合成 LIST 失败")
			}
			wantCount := 2
			if test.wantRoot {
				wantCount++
			}
			if len(boxes) != wantCount {
				t.Fatalf("可同步文件夹数量错误：得到 %d，期望 %d", len(boxes), wantCount)
			}
			inbox, child, root := false, false, false
			for _, box := range boxes {
				inbox = inbox || box.Name == "INBOX"
				child = child || (box.Name == test.options.root+"/Child" && box.Kind == "sent")
				root = root || box.Name == test.options.root
				if _, _, err := value.Select(box.Name); err != nil {
					t.Fatal("LIST 包含了服务器不可选择的虚拟入口")
				}
			}
			if !inbox || !child || root != test.wantRoot {
				t.Fatal("过滤破坏了真实收件箱、子文件夹或普通服务商父文件夹")
			}
		})
	}
}

func TestMailboxesKeepRealPermissionFailuresVisible(t *testing.T) {
	value := mailboxFixture(t, mailboxFixtureOptions{root: "[Gmail]", attributes: "\\Noselect", gmail: true, rejectChild: true})
	if _, err := value.Mailboxes(); err != nil {
		t.Fatal("合成 LIST 失败")
	}
	_, _, err := value.Select("[Gmail]/Child")
	if !errors.Is(err, domain.ErrProtocol) {
		t.Fatal("真实文件夹权限拒绝被静默忽略")
	}
	var diagnostic interface{ ResponseCode() string }
	if !errors.As(err, &diagnostic) || diagnostic.ResponseCode() != "NOPERM" {
		t.Fatal("真实拒绝码未保留")
	}
}
