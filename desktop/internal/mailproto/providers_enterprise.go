package mailproto

func enterpriseAndFallbackPresets() []ProviderPreset {
	return []ProviderPreset{
		{
			ID: "tencent_exmail", Name: "腾讯企业邮", Subtitle: "企业微信邮箱 · 自定义企业域名",
			BadgeText: "专用密码", BadgeTone: "blue", AuthMode: "app-password", SupportsAppPassword: true, OfficialIcon: true,
			GuideTitle: "连接腾讯企业邮（企业微信邮箱）", GuideSummary: "支持自定义企业域名自动识别 MX 记录，需使用客户端专用密码登录。",
			Steps: []string{
				"登录企业微信或 exmail.qq.com，确认已开启 IMAP / SMTP 收发服务",
				"在「设置 → 邮箱绑定 / 安全登录」中生成「客户端专用密码」，勿填登录密码",
				"输入完整企业邮箱地址与客户端专用密码，按需设置侧边栏显示名称",
			},
			DefaultImapHost: "imap.exmail.qq.com", DefaultImapPort: 993, DefaultImapSecurity: "SSL/TLS",
			DefaultSmtpHost: "smtp.exmail.qq.com", DefaultSmtpPort: 465, DefaultSmtpSecurity: "SSL/TLS",
			AutoAppendsSent: true,
		},
		{
			ID: "aliyun_exmail", Name: "阿里企业邮", Subtitle: "阿里云企业邮箱 · 自定义企业域名",
			BadgeText: "安全密码", BadgeTone: "amber", AuthMode: "app-password", SupportsAppPassword: true, OfficialIcon: true,
			GuideTitle: "连接阿里企业邮（阿里云企业邮箱）", GuideSummary: "支持自定义企业域名 MX 自动识别，需开启三方客户端安全密码。",
			Steps: []string{
				"登录阿里云企业邮箱网页端进入「设置 → 账户与安全」",
				"确认已允许 POP3/IMAP 收发，并生成「三方客户端安全密码」",
				"输入完整企业邮箱地址与安全密码完成四步握手测试",
			},
			DefaultImapHost: "imap.qiye.aliyun.com", DefaultImapPort: 993, DefaultImapSecurity: "SSL/TLS",
			DefaultSmtpHost: "smtp.qiye.aliyun.com", DefaultSmtpPort: 465, DefaultSmtpSecurity: "SSL/TLS",
			AutoAppendsSent: false,
		},
		{
			ID: "netease_exmail", Name: "网易企业邮", Subtitle: "华东/华北节点 · 内置 RFC2971 ID 握手",
			BadgeText: "授权密码", BadgeTone: "amber", AuthMode: "authcode", SupportsAppPassword: true, OfficialIcon: true,
			GuideTitle: "连接网易企业邮", GuideSummary: "根据 MX 自动区分华东（imaphz）与华北节点，并自动发送 RFC2971 IMAP ID。",
			Steps: []string{
				"登录网易企业邮箱网页端进入「设置 → 客户端设置」",
				"开启 IMAP/SMTP 服务并生成客户端授权密码",
				"输入企业邮箱地址后将自动匹配华东或华北节点服务器",
			},
			DefaultImapHost: "imaphz.qiye.163.com", DefaultImapPort: 993, DefaultImapSecurity: "SSL/TLS",
			DefaultSmtpHost: "smtphz.qiye.163.com", DefaultSmtpPort: 465, DefaultSmtpSecurity: "SSL/TLS",
			AutoAppendsSent: false, RequiresIMAPID: true, Note: "已内置 RFC2971 ID 握手兼容网易企业邮安全策略",
		},
		{
			ID: "feishu", Name: "飞书", Subtitle: "飞书 / Lark 企业邮箱",
			BadgeText: "专用密码", BadgeTone: "neutral", AuthMode: "app-password", SupportsAppPassword: true, OfficialIcon: true,
			GuideTitle: "连接飞书 / Lark 企业邮箱", GuideSummary: "支持飞书（imap.feishu.cn）与国际版 Lark（imap.larksuite.com）自动识别。",
			Steps: []string{
				"确认企业管理员已在飞书管理后台开启公共邮箱或客户端 IMAP/SMTP 权限",
				"在飞书邮箱「设置 → 第三方客户端登录」中生成专用密码",
				"填入完整企业邮箱地址与专用密码并测试连接",
			},
			DefaultImapHost: "imap.feishu.cn", DefaultImapPort: 993, DefaultImapSecurity: "SSL/TLS",
			DefaultSmtpHost: "smtp.feishu.cn", DefaultSmtpPort: 465, DefaultSmtpSecurity: "SSL/TLS",
			AutoAppendsSent: false,
		},
		{
			ID: "mail263", Name: "263 企业邮", Subtitle: "263 企业邮箱 · SSL/TLS 安全连接",
			BadgeText: "安全密码", BadgeTone: "neutral", AuthMode: "app-password", SupportsAppPassword: true, OfficialIcon: true,
			GuideTitle: "连接 263 企业邮箱", GuideSummary: "默认使用 imap.263.net:993 与 smtp.263.net:465 加密端口连接。",
			Steps: []string{
				"登录 263 企业邮箱网页端确认已启用客户端 IMAP/SMTP 收发权限",
				"在账户安全设置中生成客户端专用安全密码",
				"填写完整企业邮箱地址与客户端密码完成验证",
			},
			DefaultImapHost: "imap.263.net", DefaultImapPort: 993, DefaultImapSecurity: "SSL/TLS",
			DefaultSmtpHost: "smtp.263.net", DefaultSmtpPort: 465, DefaultSmtpSecurity: "SSL/TLS",
			AutoAppendsSent: false,
		},
		{
			ID: "zoho_exmail", Name: "Zoho Workplace", Subtitle: "Zoho 企业邮箱（中国/国际区）",
			BadgeText: "应用密码", BadgeTone: "violet", AuthMode: "app-password", SupportsAppPassword: true, OfficialIcon: true,
			GuideTitle: "连接 Zoho Workplace 企业邮箱", GuideSummary: "支持按域名 MX 自动匹配中国区（zoho.com.cn）、国际区（zoho.com）或欧洲区节点。",
			Steps: []string{
				"登录 Zoho Mail 网页端「设置 → 邮件账户 → IMAP 访问」勾选启用 IMAP",
				"若开启两步验证，前往 Zoho 账户安全中心生成「应用专用密码」",
				"输入企业邮箱地址（自动识别区域服务器）与密码连接",
			},
			DefaultImapHost: "imappro.zoho.com.cn", DefaultImapPort: 993, DefaultImapSecurity: "SSL/TLS",
			DefaultSmtpHost: "smtppro.zoho.com.cn", DefaultSmtpPort: 465, DefaultSmtpSecurity: "SSL/TLS",
			AutoAppendsSent: false,
		},
		{
			ID: "imap", Name: "通用 IMAP / SMTP", Subtitle: "自建邮局、企业邮箱或任意标准协议服务",
			BadgeText: "自定义配置", BadgeTone: "neutral", AuthMode: "imap", OfficialIcon: false,
			GuideTitle: "手动配置 IMAP / SMTP", GuideSummary: "自定义服务器地址、端口、加密协议，支持企业内网自签名证书指纹固定。",
			Steps:           []string{"向管理员获取 IMAP 与 SMTP 主机名、端口和加密方式", "填写登录账号与密码后运行四步测连"},
			DefaultImapHost: "", DefaultImapPort: 993, DefaultImapSecurity: "SSL/TLS",
			DefaultSmtpHost: "", DefaultSmtpPort: 465, DefaultSmtpSecurity: "SSL/TLS",
			AutoAppendsSent: false,
		},
	}
}
