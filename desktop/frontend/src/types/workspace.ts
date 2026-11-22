export type AiRunStatus =
  | "idle"
  | "processing"
  | "error"
  | "invalid-key"
  | "quota-exceeded"
  | "unavailable"
  | "disabled-sensitive";

export interface AiDeadlineItem {
  label: string;
  timeText: string;
  urgent?: boolean;
}

export interface AiMailInsight {
  summaryTitle: string;
  summary: string;
  deadlines: AiDeadlineItem[];
  draftTag: string;
  draftReply: string;
}

export interface AiChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ContactItem {
  id: string;
  name: string;
  email: string;
  avatarText: string;
  avatarTone: "blue" | "indigo" | "emerald" | "amber" | "slate" | "rose";
  company: string;
  title: string;
  sourceAccountId: string;
  sourceTag: string;
  groups: string[];
  vip: boolean;
  blocked: boolean;
  mailCount: number;
  lastContactText: string;
  phone?: string;
  note?: string;
}

export interface BlacklistEntry {
  id: string;
  target: string;
  kind: "domain" | "address";
  reason: string;
  blockedCount: number;
  addedAt: string;
}

export interface InboxRule {
  id: string;
  name: string;
  enabled: boolean;
  matchMode: "AND" | "OR";
  accountScope: string;
  conditionSummary: string;
  actionSummary: string;
  conditionField: string;
  conditionOperator: string;
  conditionValue: string;
  attachmentExt?: string;
  actionType: string;
  actionTarget: string;
  stopMatching: boolean;
  hitsLast7Days: number;
}
