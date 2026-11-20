package main

type DesktopService struct{}

// CheckConnection 只检查桌面桥接，不访问网络或邮箱。
func (s *DesktopService) CheckConnection() string {
	return "已成功连接 OmniMail 桌面后端。"
}
