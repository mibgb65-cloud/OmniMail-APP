import type { AiMailInsight } from "../../types/workspace";
import { INBOX_EXTENDED_MAILS } from "./inboxExtended";
import { INBOX_PRIMARY_MAILS } from "./inboxPrimary";
import { INBOX_SECONDARY_MAILS } from "./inboxSecondary";
import { QUEUE_AND_SECURITY_MAILS } from "./queueAndSecurity";
import { SPECIAL_FOLDER_MAILS } from "./specialFolders";

export const INITIAL_MAILS = [
  ...INBOX_PRIMARY_MAILS,
  ...INBOX_SECONDARY_MAILS,
  ...INBOX_EXTENDED_MAILS,
  ...SPECIAL_FOLDER_MAILS,
  ...QUEUE_AND_SECURITY_MAILS,
];

export const AI_INSIGHTS_BY_MAIL: Record<string, AiMailInsight> = {
  "mail-1": {
    summaryTitle: "这封邮件讲了什么",
    summary:
      "林知夏已整理 OmniMail 0.1 的三栏卡片架构与多邮箱接入边界，邀请你参加明天评审并反馈意见。",
    deadlines: [
      { label: "回复首页方案意见", timeText: "明天 12:00 前", urgent: true },
      { label: "参加 0.1 版本评审会", timeText: "明天 14:00" },
    ],
    draftTag: "简洁 · 专业",
    draftReply:
      "知夏，收到。多来源接入与三栏浮层卡片边界没有问题，明天 14:00 我会准时参会，中午前补齐细节反馈。",
  },
  "mail-6": {
    summaryTitle: "会议要点与会前准备",
    summary:
      "林知夏邀请于明天 14:00 召开 45 分钟的 0.1 发布评审会，你当前的日程无冲突，建议会前确认亮暗双主题走查与排期清单。",
    deadlines: [
      {
        label: "确认参会状态（RSVP）",
        timeText: "明天 12:00 前",
        urgent: true,
      },
      { label: "0.1 最终走查与发布评审", timeText: "明天 14:00" },
    ],
    draftTag: "简洁 · 专业",
    draftReply:
      "知夏，会议已接受。亮暗双主题与多邮箱走查结果我已在会前汇总好，明天 14:00 会议室 B302 见。",
  },
  "mail-5": {
    summaryTitle: "这封邮件讲了什么",
    summary:
      "财务团队发来 11 月研发云服务账单与报销凭证（PDF 640 KB），需要你在本周五 18:00 前核对并回复确认。",
    deadlines: [
      {
        label: "核对账单并回复确认",
        timeText: "本周五 18:00 前",
        urgent: true,
      },
    ],
    draftTag: "核对 · 简洁",
    draftReply:
      "财务同学好，11 月云服务账单明细已核对无误，同意归档报销，感谢！",
  },
};

export const DEFAULT_AI_INSIGHT: AiMailInsight = {
  summaryTitle: "这封邮件讲了什么",
  summary:
    "发件人同步了最新协作进展并附带待确认事项；正文仅在你主动触发 Omni AI 时进行本地摘要，不包含发件人地址或附件。",
  deadlines: [{ label: "查看并按需回复", timeText: "今日待办" }],
  draftTag: "简洁 · 专业",
  draftReply: "收到，感谢同步！我已查阅详细内容，稍后给出具体反馈。",
};
