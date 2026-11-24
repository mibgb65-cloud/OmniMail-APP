package services

import "omnimail/internal/outbox"

// SaveDraftInlineImage 接收前端剪贴板粘贴或拖入的 Base64 图片并写入当前空间 CAS，返回内嵌引用地址。
func (s *ComposeService) SaveDraftInlineImage(draftID, filename, mimeType, base64Data string) (outbox.DraftInlineImageDTO, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return outbox.DraftInlineImageDTO{}, err
	}
	return outbox.SaveDraftInlineImage(sess, draftID, filename, mimeType, base64Data)
}

// SaveDraftInlineImageFromPath 读取用户通过原生对话框选择的本地图片并写入当前空间 CAS。
func (s *ComposeService) SaveDraftInlineImageFromPath(draftID, filePath string) (outbox.DraftInlineImageDTO, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return outbox.DraftInlineImageDTO{}, err
	}
	return outbox.SaveDraftInlineImageFromPath(sess, draftID, filePath)
}

// SaveDraftAttachmentBytes 持久化前端拖拽传入的普通附件字节到当前空间 CAS，返回可发送的附件描述。
func (s *ComposeService) SaveDraftAttachmentBytes(draftID, filename, mimeType, base64Data string) (outbox.DraftAttachmentDTO, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return outbox.DraftAttachmentDTO{}, err
	}
	return outbox.SaveDraftAttachmentBytes(sess, draftID, filename, mimeType, base64Data)
}
