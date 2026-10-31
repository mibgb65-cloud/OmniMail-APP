package service

import (
	"context"
	"strings"

	"omnimail/desktop/internal/domain"
	"omnimail/desktop/internal/mailrender"
)

func (s *Mail) renderMessage(ctx context.Context, detail domain.MailDetail) (domain.MailDetail, error) {
	resolved := map[string]string{}
	total := int64(0)
	detail.BodyHTML = mailrender.Sanitize(detail.RawHTML, func(cid string) string {
		if value, ok := resolved[cid]; ok {
			return value
		}
		resolved[cid] = ""
		// 只允许当前邮件自己的附件 ID，不接受由 HTML 提供的本地路径或其他邮件附件 ID。
		for _, attachment := range detail.Attachments {
			if attachment.ContentID != cid {
				continue
			}
			if attachment.Size > mailrender.MaxImageBytes || total+attachment.Size > 10<<20 ||
				!strings.HasPrefix(attachment.MIME, "image/") {
				return ""
			}
			data, _, err := s.store.ReadAttachment(ctx, attachment.ID)
			if err != nil {
				s.log.Warn("内嵌图片缓存不可读，保留正文并降级图片", "code", ErrorCode(err))
				return ""
			}
			total += int64(len(data))
			resolved[cid] = mailrender.ImageData(data)
			return resolved[cid]
		}
		return ""
	})
	// 原始邮件永远不跨越 IPC 边界，清洗规则更新后从原文重新生成安全结果。
	detail.RawHTML = ""
	return detail, ctx.Err()
}
