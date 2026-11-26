export const workbuddy = {
  providerName: "WorkBuddy Agent 邮箱",
  providerDomain: "workbuddy.cn",
  addModalCardSub: "浏览器授权接入 · 智能体邮箱",
  addModalCardBadge: "官方授权",
  connectHeading: "连接 WorkBuddy 邮箱",
  summaryPill: "浏览器授权 · 仅客户端接入",

  prepStep1: "确认你的腾讯 WorkBuddy 账号已开通智能体邮箱服务。",
  prepStep2: "点击右侧「前往浏览器授权」，在官方页面完成账号登录并确认授权。",
  prepStep3: "授权通过后将自动识别绑定的智能体邮箱地址，确认即可开始查阅邮件。",
  prepFootnote: "不同服务商的登录与安全流程可能变化，请以其官方说明为准。",
  footerNote:
    "授权令牌经本机加密存储于当前空间凭据库，支持随时在设置中解绑移除。",

  authFieldLabel: "浏览器授权登录",
  authCardTitle: "腾讯 WorkBuddy 官方授权",
  authStageIdle: "未授权",
  authStagePolling: "等待授权中",
  authStageAuthorized: "已完成授权",
  authStageNotBound: "尚未开通邮箱",
  authCardDescIdle:
    "跳转系统默认浏览器完成腾讯 WorkBuddy 登录与授权，无需输入账号密码。",
  authCardDescPolling:
    "已在系统浏览器打开官方授权页，请在网页中确认登录，完成后将自动同步状态…",
  authCardDescAuthorized:
    "已完成官方账号核验并识别绑定的智能体邮箱别名，可直接完成接入。",

  notBoundTitle: "当前账号尚未开通智能体邮箱",
  notBoundDesc:
    "请先在腾讯 WorkBuddy 客户端或官方页面开通并绑定智能体邮箱，随后点击「重新授权」同步状态。",
  statusDeactivatedHint: "该智能体邮箱处于停用状态，历史邮件仍可正常查阅。",
  statusSuspendedHint:
    "当前智能体邮箱状态为 {status}，请前往 WorkBuddy 官方管理页检查后再试。",

  startAuthBtn: "前往浏览器授权",
  cancelAuthBtn: "取消授权",
  reauthorizeBtn: "重新授权",

  detectedEmailLabel: "已识别邮箱地址",
  detectedEmailPlaceholder: "完成浏览器授权后自动识别主别名邮箱",
  authVerifiedPill: "授权已核验",

  accountNameLabel: "账户名称",
  accountNamePlaceholder: "例如：WorkBuddy 智能体邮箱",
  defaultAccountName: "WorkBuddy 智能体邮箱",

  connectionModeLabel: "连接方式",
  connectionModeValue:
    "内置原生 REST 网关（HTTPS 自动续期 · 收发记录与附件下载）",

  infoBannerTitle: "连接前将自动验证令牌状态与智能体邮箱别名",
  infoBannerDesc:
    "授权令牌经本机加密存储于当前空间凭据库，支持随时在设置中解绑移除。",
  infoBannerReadyDesc:
    "已识别主别名 {email}，点击下方「完成并接入」即可开始查阅收发记录。",

  completeConnectBtn: "完成并接入",
  connectingBtn: "正在接入…",
  connectedBtn: "接入成功",
  retryConnectBtn: "重试接入",
  errorCodeLabel: "错误码：{code}",

  connectedToast: "已接入 WorkBuddy 邮箱 {email}",
  disconnectedToast: "已解绑 WorkBuddy 邮箱 {email}",

  sidebarSectionTitle: "智能体邮箱",
  sidebarEntryAria: "{name}（WorkBuddy 智能体邮箱）",
  settingsCardSub: "{email} · 浏览器官方授权",
  openViewBtn: "查看邮件",
  disconnectBtn: "解绑账户",

  inboxTab: "收件箱",
  sentTab: "已发送",
  searchPlaceholder: "搜索邮件主题、往来地址或正文关键词…",
  clearSearchAria: "清空搜索关键词",
  refreshBtn: "刷新",
  refreshingBtn: "刷新中…",
  dailyQuotaBadge: "今日配额 {remaining}/{limit}",
  quotaCompactBadge: "配额 {remaining}/{limit}",
  lastRefreshedAt: "最近同步 {time}",
  notRefreshedYet: "点击刷新同步最新邮件",
  listSubtitle: "{email} · {count} 封",
  listGroupSyncedAt: "最近邮件 · 同步于 {time}",
  listGroupRecent: "最近邮件",
  toggleSearchTip: "搜索当前智能体邮箱",
  sourceTag: "WorkBuddy",
  fromWorkBuddySuffix: "来自 WorkBuddy",
  singleThreadMeta: "1 封会话",
  copySenderBtn: "复制发件人",
  copiedSenderToast: "已复制发件人邮箱：{email}",
  refreshBodyBtn: "刷新正文",
  copyMailboxBtn: "复制邮箱地址",
  copiedMailboxToast: "已复制智能体邮箱地址：{email}",
  replyViaRegularBtn: "用常规邮箱写信回复",
  footerSyncedStatus:
    "WorkBuddy 智能体邮箱 · 最近同步于 {time}（由本机加密通道直连）",
  footerIdleStatus: "WorkBuddy 智能体邮箱 · 由本机加密通道直连",

  listCountLabel: "{count} 封邮件",
  loadMoreBtn: "加载更多",
  loadingMoreBtn: "正在加载…",
  emptyInboxTitle: "收件箱暂无邮件",
  emptySentTitle: "暂无已发送记录",
  emptySearchTitle: "未找到匹配的邮件",
  emptyListDesc:
    "新收发的智能体邮件同步后将在此处展示，可点击顶部「刷新」立即拉取。",
  selectMessageTitle: "选择一封邮件查看正文",
  selectMessageDesc: "在左侧列表中点击任意邮件，即可安全查阅正文与下载附件。",
  noSubject: "（无主题）",
  senderLabel: "发件人",
  recipientsLabel: "收件人",
  ccLabel: "抄送",
  unreadDotAria: "未读邮件",

  markReadBtn: "标记已读",
  alreadyReadLabel: "已读",
  downloadAttachmentBtn: "下载附件",
  attachmentsHeading: "附件（{count}）",
  saveAttachmentItemBtn: "另存为",
  attachmentSavedToast: "附件已保存：{filename}",
  deleteBtn: "删除",

  deleteModalTitle: "确认删除邮件？",
  deleteModalDesc:
    "即将从 WorkBuddy 智能体邮箱中永久删除「{subject}」，删除后不可恢复。",
  confirmDeleteBtn: "确认永久删除",
  deletingBtn: "正在删除…",
  deletedToast: "邮件已删除",
};

export const workbuddyErrors = {
  ERR_WB_AUTH_REQUIRED: "WorkBuddy 登录状态已失效，请重新完成浏览器授权",
  ERR_WB_AUTH_TIMEOUT: "等待浏览器授权超时，请重新点击授权按钮",
  ERR_WB_NOT_BOUND: "当前 WorkBuddy 账号尚未开通智能体邮箱服务",
  ERR_WB_SUSPENDED: "当前智能体邮箱账号受限或已被冻结",
  ERR_WB_QUOTA_EXCEEDED: "今日智能体邮箱操作配额已用完",
  ERR_WB_RATE_LIMITED: "请求过于频繁，请稍后再试",
  ERR_WB_ATTACHMENT_TOO_LARGE: "附件体积超过 25MB 下载上限",
  ERR_WB_GATEWAY_FAILED: "连接 WorkBuddy 邮箱服务失败，请稍后重试",
  ERR_WB_CANCELLED: "已取消 WorkBuddy 浏览器授权",
};
