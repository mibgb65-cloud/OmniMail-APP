import type {
  LoginSessionProbeDTO,
  MessageDTO,
  StatusDTO,
  ThreadDetailDTO,
  ThreadListDTO,
  ThreadSummaryDTO,
  VerifyResultDTO,
} from "../../bindings/omnimail/internal/musemail/models";
import {
  BeginConnect,
  CancelRefresh,
  CheckLoginSessionReady,
  ConfirmConnection,
  Disconnect,
  GetStatus,
  GetThread,
  ListThreads,
  VerifyConnection,
} from "../../bindings/omnimail/services/musemailservice";
import { isWailsDesktop } from "../state/storageHelpers";
import {
  INITIAL_MUSE_STATUS,
  type MuseDirection,
  type MuseLoginStage,
  type MuseMessage,
  type MuseStatus,
  type MuseThreadDetail,
  type MuseThreadList,
  type MuseThreadSummary,
} from "../types/muse";

function mapStage(raw: string): MuseLoginStage {
  if (
    raw === "login_open" ||
    raw === "verified" ||
    raw === "connected" ||
    raw === "idle"
  ) {
    return raw;
  }
  return "idle";
}

function mapDirection(raw: string): MuseDirection {
  if (raw === "inbound" || raw === "outbound") return raw;
  return "unknown";
}

function mapStatus(dto: StatusDTO): MuseStatus {
  return {
    loginStage: mapStage(dto.loginStage),
    bound: Boolean(dto.bound),
    verifiedEmail: dto.verifiedEmail ?? "",
    accountName: dto.accountName ?? "",
    lastRefreshedAt: dto.lastRefreshedAt ?? 0,
    lastErrorCode: dto.lastErrorCode || undefined,
  };
}

function mapThreadSummary(dto: ThreadSummaryDTO): MuseThreadSummary {
  return {
    id: dto.id,
    subject: dto.subject ?? "",
    messageCount: dto.messageCount ?? 1,
    participants: dto.participants ?? [],
    lastFrom: dto.lastFrom ?? "",
    lastFromName: dto.lastFromName ?? "",
    preview: dto.preview ?? "",
    createdAtMs: dto.createdAtMs ?? 0,
    timeKnown: Boolean(dto.timeKnown),
  };
}

function mapThreadList(dto: ThreadListDTO): MuseThreadList {
  return {
    email: dto.email ?? "",
    accountName: dto.accountName ?? "",
    threads: (dto.threads ?? []).map(mapThreadSummary),
    nextCursor: dto.nextCursor ?? "",
    hasMore: Boolean(dto.hasMore),
    lastRefreshedAt: dto.lastRefreshedAt ?? 0,
  };
}

function mapMessage(dto: MessageDTO): MuseMessage {
  return {
    id: dto.id,
    threadId: dto.threadId,
    direction: mapDirection(dto.direction),
    from: dto.from ?? "",
    fromName: dto.fromName ?? "",
    to: dto.to ?? [],
    cc: dto.cc ?? [],
    subject: dto.subject ?? "",
    createdAtMs: dto.createdAtMs ?? 0,
    timeKnown: Boolean(dto.timeKnown),
    bodyText: dto.bodyText ?? "",
    museAuthVerdict: dto.museAuthVerdict || undefined,
    attachments: (dto.attachments ?? []).map((a) => ({
      index: a.index ?? 0,
      filename: a.filename ?? "attachment",
      mimeType: a.mimeType ?? "",
      size: a.size ?? 0,
    })),
  };
}

function mapThreadDetail(dto: ThreadDetailDTO): MuseThreadDetail {
  return {
    id: dto.id,
    subject: dto.subject ?? "",
    email: dto.email ?? "",
    messages: (dto.messages ?? []).map(mapMessage),
  };
}

function requireDesktopErr(): never {
  throw new Error(
    "[ERR_MUSE_UNSUPPORTED] 独立 WebView2 登录仅在桌面客户端中可用",
  );
}

export const museMailApi = {
  async getStatus(): Promise<MuseStatus> {
    if (!isWailsDesktop()) return INITIAL_MUSE_STATUS;
    return mapStatus(await GetStatus());
  },

  async beginConnect(): Promise<MuseStatus> {
    if (!isWailsDesktop()) requireDesktopErr();
    return mapStatus(await BeginConnect());
  },

  async checkLoginSessionReady(): Promise<LoginSessionProbeDTO> {
    if (!isWailsDesktop()) {
      return { windowOpen: false, sessionReady: false };
    }
    const dto = await CheckLoginSessionReady();
    return {
      windowOpen: Boolean(dto.windowOpen),
      sessionReady: Boolean(dto.sessionReady),
    };
  },

  async verifyConnection(): Promise<VerifyResultDTO> {
    if (!isWailsDesktop()) requireDesktopErr();
    return VerifyConnection();
  },

  async confirmConnection(accountName: string): Promise<MuseStatus> {
    if (!isWailsDesktop()) requireDesktopErr();
    return mapStatus(await ConfirmConnection(accountName));
  },

  async listThreads(cursor = ""): Promise<MuseThreadList> {
    if (!isWailsDesktop()) requireDesktopErr();
    return mapThreadList(await ListThreads(cursor));
  },

  async getThread(threadRef: string): Promise<MuseThreadDetail> {
    if (!isWailsDesktop()) requireDesktopErr();
    return mapThreadDetail(await GetThread(threadRef));
  },

  async cancelRefresh(): Promise<void> {
    if (!isWailsDesktop()) return;
    await CancelRefresh();
  },

  async disconnect(): Promise<MuseStatus> {
    if (!isWailsDesktop()) return INITIAL_MUSE_STATUS;
    return mapStatus(await Disconnect());
  },
};
