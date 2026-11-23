package mailproto

import (
	"slices"
	"strings"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"
)

type DiscoveredMailbox struct {
	RemoteName  string             `json:"remoteName"`
	LocalFolder string             `json:"localFolder"`
	NoSelect    bool               `json:"noSelect"`
	Attrs       []imap.MailboxAttr `json:"-"`
}

// DiscoverMailboxes 执行 IMAP LIST 并优先基于 RFC6154 Special-Use 映射到本地标准文件夹。
func DiscoverMailboxes(client *imapclient.Client) ([]DiscoveredMailbox, error) {
	opts := &imap.ListOptions{}
	if client.Caps().Has(imap.CapSpecialUse) || client.Caps().Has(imap.CapIMAP4rev2) {
		opts.ReturnSpecialUse = true
	}
	rawList, err := client.List("", "*", opts).Collect()
	if err != nil {
		rawList, err = client.List("", "*", nil).Collect()
		if err != nil {
			return nil, err
		}
	}

	assigned := make(map[string]bool)
	out := make([]DiscoveredMailbox, 0, len(rawList))

	// 第一轮：优先匹配 INBOX 与 RFC6154 Special-Use 属性
	for _, item := range rawList {
		noSelect := slices.Contains(item.Attrs, imap.MailboxAttrNoSelect) ||
			slices.Contains(item.Attrs, imap.MailboxAttrNonExistent)
		local := matchByAttr(item.Mailbox, item.Attrs)
		if local != "custom" && !noSelect && !assigned[local] {
			assigned[local] = true
		} else if local != "inbox" {
			local = "custom"
		}
		out = append(out, DiscoveredMailbox{
			RemoteName:  item.Mailbox,
			LocalFolder: local,
			NoSelect:    noSelect,
			Attrs:       item.Attrs,
		})
	}

	// 第二轮：对尚未匹配到 Special-Use 的标准文件夹使用多语言名称回退
	for i := range out {
		if out[i].NoSelect || out[i].LocalFolder != "custom" {
			continue
		}
		fallback := matchByNameFallback(out[i].RemoteName)
		if fallback != "custom" && !assigned[fallback] {
			assigned[fallback] = true
			out[i].LocalFolder = fallback
		}
	}
	return out, nil
}

func matchByAttr(name string, attrs []imap.MailboxAttr) string {
	if strings.EqualFold(strings.TrimSpace(name), "INBOX") {
		return "inbox"
	}
	if slices.Contains(attrs, imap.MailboxAttrSent) {
		return "sent"
	}
	if slices.Contains(attrs, imap.MailboxAttrDrafts) {
		return "drafts"
	}
	if slices.Contains(attrs, imap.MailboxAttrArchive) || slices.Contains(attrs, imap.MailboxAttrAll) {
		return "archive"
	}
	if slices.Contains(attrs, imap.MailboxAttrJunk) {
		return "spam"
	}
	if slices.Contains(attrs, imap.MailboxAttrTrash) {
		return "trash"
	}
	return "custom"
}

func matchByNameFallback(remoteName string) string {
	norm := strings.ToLower(strings.TrimSpace(remoteName))
	// 取最后一级路径名兼容 INBOX.Sent / [Gmail]/Sent Mail
	leaf := norm
	for _, sep := range []string{"/", "."} {
		if idx := strings.LastIndex(leaf, sep); idx >= 0 && idx < len(leaf)-1 {
			leaf = leaf[idx+1:]
		}
	}
	switch leaf {
	case "sent", "sent mail", "sent messages", "sent items", "已发送", "보낸편지함", "отправленные":
		return "sent"
	case "drafts", "draft", "草稿箱", "草稿", "임시보관함", "черновики":
		return "drafts"
	case "archive", "all mail", "归档", "보관함", "архив":
		return "archive"
	case "spam", "junk", "junk e-mail", "bulk mail", "垃圾邮件", "스팸편지함", "спам":
		return "spam"
	case "trash", "deleted", "deleted messages", "deleted items", "已删除", "휴지통", "удаленные":
		return "trash"
	}
	return "custom"
}
