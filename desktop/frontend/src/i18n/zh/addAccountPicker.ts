export const addAccountPicker = {
  pickerPresetBadge: "{count} 家内置预设 · 支持自定义域名 MX 识别",
  pickerSubtitle:
    "选择需要接入的邮箱服务商 · 凭据经本机 DPAPI 加密存储于当前独立空间",
  pickerFooterNote:
    "选择服务商后将在同尺寸窗口内平滑进入连接配置，并可自由设置左侧栏显示名称。",
  pickerManualBtn: "手动 IMAP / SMTP",

  pickerCategoryHeading: "邮箱分类",
  pickerCatAll: "全部服务商",
  pickerCatAgent: "AI Agent 邮箱",
  pickerCatStandard: "个人与常规",
  pickerCatEnterprise: "企业邮箱",

  pickerAuthModesHeading: "支持接入方式",
  pickerModeOAuth: "OAuth 2.0",
  pickerModeAuthCode: "客户端专用密码",
  pickerModeMxProbe: "MX 域名探测",
  pickerModeAgentGateway: "原生 Agent 网关",

  pickerManualCardTitle: "手动 IMAP / SMTP",
  pickerManualCardSub: "自建邮局 / Coremail / 华为云，支持自定义命名",
  pickerVaultFootnote: "所有令牌仅加密存于本空间 secrets.vault，永不明文落盘。",

  pickerSearchPlaceholder: "搜索企业邮箱、自定义域名、服务商或主机名…",
  pickerSearchAria: "搜索邮箱服务商",
  pickerClearSearchAria: "清除搜索关键词",
  pickerSummaryCount: "{category} · 共 {count} 家内置预设",

  pickerGroupAgentHint: "内置原生协议接入 · 无需安装 CLI",
  pickerGroupStandardHint: "支持 IMAP / SMTP 收发同步与精简简称",
  pickerGroupEnterpriseHint: "输入自定义企业域名后自动匹配服务器并支持命名",

  pickerCustomCardTitle: "其他自定义邮箱",
  pickerCustomCardSub: "手动配置 IMAP / SMTP 主机端口",
  pickerCustomCardBadge: "标准协议",

  pickerEnterpriseOAuthTitle: "Microsoft 365 与 Google Workspace 企业版",
  pickerEnterpriseOAuthSub:
    "支持企业自定义域名 OAuth 2.0 现代认证，可直接通过官方浏览器授权接入。",
  pickerEnterpriseM365Btn: "Microsoft 365",
  pickerEnterpriseGwsBtn: "Google Workspace",
  pickerEnterpriseManualTitle: "自建邮局 / Coremail / 华为云 / 其他企业邮箱",
  pickerEnterpriseManualSub:
    "输入邮箱自动探测 MX 与 DNS SRV，支持自定义账户显示名与自签名证书指纹固定",
  pickerEnterpriseManualBtn: "手动配置",

  pickerEmptyTitle: "未找到匹配的服务商",
  pickerEmptyDesc: "可尝试更换关键词，或直接手动配置 IMAP / SMTP 服务器参数。",
  pickerClearSearchBtn: "清除搜索",
};
