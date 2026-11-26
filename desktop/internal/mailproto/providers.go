package mailproto

type ProviderPreset struct {
	ID                  string   `json:"id"`
	Name                string   `json:"name"`
	Subtitle            string   `json:"subtitle"`
	BadgeText           string   `json:"badgeText"`
	BadgeTone           string   `json:"badgeTone"`
	AuthMode            string   `json:"authMode"`
	SupportsAppPassword bool     `json:"supportsAppPassword"`
	OfficialIcon        bool     `json:"officialIcon"`
	GuideTitle          string   `json:"guideTitle"`
	GuideSummary        string   `json:"guideSummary"`
	Steps               []string `json:"steps"`
	DefaultImapHost     string   `json:"defaultImapHost"`
	DefaultImapPort     int      `json:"defaultImapPort"`
	DefaultImapSecurity string   `json:"defaultImapSecurity"`
	DefaultSmtpHost     string   `json:"defaultSmtpHost"`
	DefaultSmtpPort     int      `json:"defaultSmtpPort"`
	DefaultSmtpSecurity string   `json:"defaultSmtpSecurity"`
	AutoAppendsSent     bool     `json:"autoAppendsSent"`
	RequiresIMAPID      bool     `json:"requiresImapId"`
	Note                string   `json:"note,omitempty"`
	DetectedVia         string   `json:"detectedVia,omitempty"`
}

func ListProviderPresets() []ProviderPreset {
	out := make([]ProviderPreset, 0, 16)
	out = append(out, standardProviderPresets()...)
	out = append(out, enterpriseAndFallbackPresets()...)
	return out
}

func standardProviderPresets() []ProviderPreset {
	return []ProviderPreset{
		{
			ID: "gmail", Name: "Gmail", Subtitle: "支持 OAuth 2.0 授权或 16 位应用专用密码",
			BadgeText: "OAuth / 应用密码", BadgeTone: "blue", AuthMode: "oauth", SupportsAppPassword: true, OfficialIcon: true,
			GuideTitle: "连接 Google Gmail", GuideSummary: "推荐使用浏览器 OAuth 2.0 授权，或使用 Google 两步验证生成的 16 位应用专用密码接入。",
			Steps: []string{
				"前往 Google 账户「安全性 → 两步验证 → 应用专用密码」",
				"生成 16 位专用密码（复制带空格格式即可，系统会自动去除空格）",
				"确保 Gmail 网页端已启用 IMAP 访问权限",
			},
			DefaultImapHost: "imap.gmail.com", DefaultImapPort: 993, DefaultImapSecurity: "SSL/TLS",
			DefaultSmtpHost: "smtp.gmail.com", DefaultSmtpPort: 465, DefaultSmtpSecurity: "SSL/TLS",
			AutoAppendsSent: true, Note: "开源自编译环境未配置 OAuth Client ID 时，可直接用 16 位应用专用密码登录",
		},
		{
			ID: "outlook", Name: "Outlook / Microsoft 365", Subtitle: "支持个人 Outlook、Hotmail 与企业 365",
			BadgeText: "OAuth 2.0", BadgeTone: "blue", AuthMode: "oauth", SupportsAppPassword: true, OfficialIcon: true,
			GuideTitle: "连接 Outlook / Microsoft 365", GuideSummary: "通过微软官方 OAuth 2.0 PKCE 流程获取 IMAP/SMTP 访问令牌。",
			Steps:           []string{"在系统默认浏览器中登录微软账户", "确认勾选离线访问与邮件读写授权范围", "完成后自动回跳本地安全端口"},
			DefaultImapHost: "outlook.office365.com", DefaultImapPort: 993, DefaultImapSecurity: "SSL/TLS",
			DefaultSmtpHost: "smtp.office365.com", DefaultSmtpPort: 587, DefaultSmtpSecurity: "STARTTLS",
			AutoAppendsSent: true,
		},
		{
			ID: "qq", Name: "QQ 邮箱", Subtitle: "支持 @qq.com 与 @foxmail.com",
			BadgeText: "16 位授权码", BadgeTone: "amber", AuthMode: "authcode", OfficialIcon: true,
			GuideTitle: "连接腾讯 QQ 邮箱", GuideSummary: "需在网页版开启 IMAP/SMTP 服务并生成 16 位客户端授权码。",
			Steps:           []string{"登录 mail.qq.com 进入「设置 → 账户」", "开启「IMAP/SMTP 服务」并完成密保验证", "复制生成的 16 位授权码填入下方（切勿填写 QQ 登录密码）"},
			DefaultImapHost: "imap.qq.com", DefaultImapPort: 993, DefaultImapSecurity: "SSL/TLS",
			DefaultSmtpHost: "smtp.qq.com", DefaultSmtpPort: 465, DefaultSmtpSecurity: "SSL/TLS",
			AutoAppendsSent: true,
		},
		{
			ID: "netease", Name: "网易邮箱 (163/126/yeah)", Subtitle: "按邮箱后缀自动识别服务器并发送安全 ID",
			BadgeText: "客户端授权码", BadgeTone: "amber", AuthMode: "authcode", OfficialIcon: true,
			GuideTitle: "连接网易邮箱（163 / 126 / yeah.net）", GuideSummary: "自动携带 RFC2971 客户端身份标识，避免触发 Unsafe Login 拦截。",
			Steps:           []string{"登录网易邮箱网页版进入「设置 → POP3/SMTP/IMAP」", "开启「IMAP/SMTP 服务」", "新增并复制客户端授权密码填入下方"},
			DefaultImapHost: "imap.163.com", DefaultImapPort: 993, DefaultImapSecurity: "SSL/TLS",
			DefaultSmtpHost: "smtp.163.com", DefaultSmtpPort: 465, DefaultSmtpSecurity: "SSL/TLS",
			AutoAppendsSent: false, RequiresIMAPID: true, Note: "已内置 RFC2971 ID 握手兼容网易安全策略",
		},
		{
			ID: "icloud", Name: "iCloud 邮件", Subtitle: "支持 @icloud.com / @me.com",
			BadgeText: "专用密码", BadgeTone: "neutral", AuthMode: "app-password", OfficialIcon: true,
			GuideTitle: "连接 Apple iCloud 邮件", GuideSummary: "需使用 Apple 账户中心生成的 xxxx-xxxx-xxxx-xxxx 应用专用密码。",
			Steps:           []string{"访问 account.apple.com 登录 Apple 账户", "在「登录和安全 → App 专用密码」中生成新密码", "使用完整 @icloud.com 邮箱地址与该专用密码连接"},
			DefaultImapHost: "imap.mail.me.com", DefaultImapPort: 993, DefaultImapSecurity: "SSL/TLS",
			DefaultSmtpHost: "smtp.mail.me.com", DefaultSmtpPort: 587, DefaultSmtpSecurity: "STARTTLS",
			AutoAppendsSent: false,
		},
		{
			ID: "yahoo", Name: "Yahoo Mail", Subtitle: "支持 @yahoo.com 国际邮箱",
			BadgeText: "应用密码", BadgeTone: "violet", AuthMode: "app-password", OfficialIcon: true,
			GuideTitle: "连接 Yahoo Mail", GuideSummary: "在 Yahoo 账户安全设置中生成第三方邮件客户端专用密码。",
			Steps:           []string{"打开 Yahoo Account Security 页面", "点击「Generate app password」生成 16 位应用密码", "填入完整邮箱与生成的应用密码"},
			DefaultImapHost: "imap.mail.yahoo.com", DefaultImapPort: 993, DefaultImapSecurity: "SSL/TLS",
			DefaultSmtpHost: "smtp.mail.yahoo.com", DefaultSmtpPort: 465, DefaultSmtpSecurity: "SSL/TLS",
			AutoAppendsSent: true,
		},
		{
			ID: "yandex", Name: "Yandex Mail", Subtitle: "支持 @yandex.com / @yandex.ru",
			BadgeText: "应用密码", BadgeTone: "amber", AuthMode: "app-password", OfficialIcon: true,
			GuideTitle: "连接 Yandex Mail", GuideSummary: "需在网页端开启 IMAP 客户端协议并生成邮件专用密码。",
			Steps:           []string{"在 Yandex Mail 设置「Email clients」中勾选开启 IMAP", "前往 Yandex ID「App passwords」生成邮件应用密码", "填入完整邮箱与应用密码"},
			DefaultImapHost: "imap.yandex.com", DefaultImapPort: 993, DefaultImapSecurity: "SSL/TLS",
			DefaultSmtpHost: "smtp.yandex.com", DefaultSmtpPort: 465, DefaultSmtpSecurity: "SSL/TLS",
			AutoAppendsSent: false,
		},
		{
			ID: "linuxdo", Name: "Linux.do 邮箱", Subtitle: "社区专属邮局 (@linux.do)",
			BadgeText: "专用密码", BadgeTone: "violet", AuthMode: "app-password", OfficialIcon: false,
			GuideTitle: "连接 Linux.do 社区邮箱", GuideSummary: "默认预填 mail.linux.do / smtp.linux.do 安全端口，支持按需覆写服务器地址。",
			Steps:           []string{"获取您的 @linux.do 邮箱地址与客户端应用专用密码", "核对下方 IMAP/SMTP 主机（默认 mail.linux.do:993 与 smtp.linux.do:465）", "点击测试连接完成四步握手校验"},
			DefaultImapHost: "mail.linux.do", DefaultImapPort: 993, DefaultImapSecurity: "SSL/TLS",
			DefaultSmtpHost: "smtp.linux.do", DefaultSmtpPort: 465, DefaultSmtpSecurity: "SSL/TLS",
			AutoAppendsSent: false,
		},
		{
			ID: "nevermail", Name: "Naver Mail", Subtitle: "韩国 Naver 邮箱 (@naver.com)",
			BadgeText: "应用密码", BadgeTone: "neutral", AuthMode: "app-password", OfficialIcon: false,
			GuideTitle: "连接韩国 Naver Mail (@naver.com)", GuideSummary: "已内置 imap.naver.com:993 与 smtp.naver.com:465 官方安全预设。",
			Steps:           []string{"登录 mail.naver.com 在「环境设置 → POP3/IMAP 设置」中启用 IMAP/SMTP", "在 Naver 账户两步验证中生成应用程序密码", "输入完整 @naver.com 地址与应用密码"},
			DefaultImapHost: "imap.naver.com", DefaultImapPort: 993, DefaultImapSecurity: "SSL/TLS",
			DefaultSmtpHost: "smtp.naver.com", DefaultSmtpPort: 465, DefaultSmtpSecurity: "SSL/TLS",
			AutoAppendsSent: false, Note: "SMTP 同时兼容 465 SSL/TLS 与 587 STARTTLS",
		},
	}
}
