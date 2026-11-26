export const providerConnect = {
  connectHeading: "连接 {provider}",
  connectBadgeExisting: "已有账户接入",
  connectBadgeEnterprise: "企业邮箱预设 · 支持自定义命名",
  connectSubtitleUnified: "已有邮箱的客户端接入 · 不会为你注册第三方邮箱",
  connectSubtitleEnterprise:
    "输入企业邮箱后自动核验域名 MX 记录，凭据经本机 DPAPI 加密保存于当前空间",
  summaryTlsPill: "TLS 安全连接 · 仅客户端接入",
  summaryOAuthPill: "OAuth 2.0 授权 · 仅客户端接入",
  prepCardTitle: "先准备，再连接",
  prepCardBadge: "3 步指引",
  viewOfficialGuideBtn: "查看官方接入指引",
  noAutoRedirectHint: "不会自动跳转或代填第三方登录页。",
  accountNameLabel: "账户显示名称（侧边栏展示）",
  accountNameDefaultHint: "留空默认显示“{defaultName}”",
  accountNamePlaceholder: "例如：腾讯企业邮 / 公司工作邮",
  quickNameLabel: "快捷命名：",
  mxDetectedPill: "MX 已自动识别：{mxHost} → {provider}",
  sidebarPreviewTitle: "侧边栏实时预览",
  sidebarPreviewHint:
    "第 1 行显示自定义名称或品牌简称，第 2 行直接展示真实邮箱地址。",
  namingInfoNote:
    "账户显示名称仅用于侧边栏、切换器与设置页辨识，不影响对外发信时的「发件人姓名」。",
  secretLabelAuthCode: "客户端授权码",
  secretLabelAppPassword: "App 专用密码",
  secretLabelClientPassword: "客户端专用密码",
  secretLabelSecurityPwd: "三方客户端安全密码",
  secretLabelClientToken: "客户端专用令牌",
  localEncryptedPill: "本机加密",
  secretInputPlaceholder: "在本机安全输入，不在预览中展示真实凭据",
  serverConfigLabel: "服务器配置",
  serverConfigToggle: "使用 {provider} 推荐配置（IMAP/SMTP TLS）· 可展开核对",
  imapHostFieldLabel: "IMAP 主机",
  smtpHostFieldLabel: "SMTP 主机",
  infoBannerTitle: "连接前会分别验证收信与发信",
  infoBannerDesc:
    "专用凭据仅用于你选择的邮箱连接，存储在本地凭据库，可在设置中随时移除。",
  footerSafetyNote: "不同服务商的安全设置可能变化，请以其官方说明为准。",
  backToSourceBtn: "返回选择服务商",
  testAndConnectBtn: "测试并连接",
  manualSummaryName: "标准 IMAP / SMTP",
  manualSummaryDomains: "企业邮箱 / 自建邮局 / 标准协议",
  manualPrepStep1:
    "向邮箱管理员或服务商确认 IMAP / SMTP 主机地址、端口号与加密方式。",
  manualPrepStep2:
    "准备邮箱登录密码或客户端专用密码；内网自签名服务器可在探测后固定证书指纹。",
  manualPrepStep3:
    "输入企业邮箱可自动识别 MX 预设并自由命名，随后测试收信与发信连接。",
  manualFooterHint:
    "标准协议参数由所属组织或邮件服务商提供，支持事后随时重命名。",
  oauthBrowserCardTitle: "浏览器安全授权",
  oauthStepBrowserLabel: "1. 系统浏览器打开官方授权页",
  oauthStepConsentLabel: "2. 确认邮箱读写与离线同步范围",
  oauthStepCallbackLabel: "3. 本机回跳加密写入凭据库",
  oauthStatusReady: "已打开",
  oauthStatusPending: "等待授权",
  oauthFallbackHint:
    "若当前网络无法完成浏览器回跳或未配置 OAuth Client ID，可随时改用 16 位应用专用密码直连。",
};
