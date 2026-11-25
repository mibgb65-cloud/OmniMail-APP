export type MuseLoginStage = "idle" | "login_open" | "verified" | "connected";

export type MuseDirection = "inbound" | "outbound" | "unknown";

export type MuseViewStateKind =
  | "ready"
  | "empty"
  | "not_enabled"
  | "auth_expired"
  | "identity_changed"
  | "gateway_error"
  | "session_cleared";

export const MUSE_OFFICIAL_GUIDE_URL =
  "https://www.meta.com/help/superintelligence/1149305437517250/";

export interface MuseStatus {
  loginStage: MuseLoginStage;
  bound: boolean;
  verifiedEmail: string;
  accountName: string;
  lastRefreshedAt: number;
  lastErrorCode?: string;
}

export interface MuseThreadSummary {
  id: string;
  subject: string;
  messageCount: number;
  participants: string[];
  lastFrom: string;
  lastFromName: string;
  preview: string;
  createdAtMs: number;
  timeKnown: boolean;
}

export interface MuseThreadList {
  email: string;
  accountName: string;
  threads: MuseThreadSummary[];
  nextCursor: string;
  hasMore: boolean;
  lastRefreshedAt: number;
}

export interface MuseAttachmentMeta {
  index: number;
  filename: string;
  mimeType: string;
  size: number;
}

export interface MuseMessage {
  id: string;
  threadId: string;
  direction: MuseDirection;
  from: string;
  fromName: string;
  to: string[];
  cc: string[];
  subject: string;
  createdAtMs: number;
  timeKnown: boolean;
  bodyText: string;
  museAuthVerdict?: string;
  attachments: MuseAttachmentMeta[];
}

export interface MuseThreadDetail {
  id: string;
  subject: string;
  email: string;
  messages: MuseMessage[];
}

export const INITIAL_MUSE_STATUS: MuseStatus = {
  loginStage: "idle",
  bound: false,
  verifiedEmail: "",
  accountName: "",
  lastRefreshedAt: 0,
};

export function classifyMuseViewState(params: {
  bound: boolean;
  clearedBySessionReset: boolean;
  errorCode?: string;
  threadsCount: number;
  loading: boolean;
}): MuseViewStateKind {
  const code = params.errorCode ?? "";
  if (code === "ERR_MUSE_IDENTITY_CHANGED") return "identity_changed";
  if (code === "ERR_MUSE_NOT_ENABLED") return "not_enabled";
  if (code === "ERR_MUSE_AUTH_EXPIRED" || code === "ERR_MUSE_NOT_LOGGED_IN") {
    return "auth_expired";
  }
  if (params.clearedBySessionReset || !params.bound) {
    return "session_cleared";
  }
  if (code && code !== "ERR_MUSE_CANCELLED") {
    return "gateway_error";
  }
  if (!params.loading && params.threadsCount === 0) {
    return "empty";
  }
  return "ready";
}

export function splitMuseBodyParagraphs(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  return normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

export function formatMuseByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
