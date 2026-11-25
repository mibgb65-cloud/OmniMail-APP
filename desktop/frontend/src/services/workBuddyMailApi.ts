import {
  CancelAuth,
  ConnectAccount,
  DeleteMessage,
  DisconnectAccount,
  GetMessageDetail,
  GetStatusAndAliases,
  ListMessages,
  MarkAsRead,
  PollAuthStatus,
  SaveAttachment,
  SearchMessages,
  StartAuth,
} from "../../bindings/omnimail/services/workbuddymailservice";
import { isWailsDesktop } from "../state/storageHelpers";
import {
  EMPTY_DAILY_QUOTA,
  type WorkBuddyAccount,
  type WorkBuddyAttachmentSaveResult,
  type WorkBuddyAuthPoll,
  type WorkBuddyAuthStart,
  type WorkBuddyDeleteResult,
  type WorkBuddyDirection,
  type WorkBuddyMessageDetail,
  type WorkBuddyMessageList,
  type WorkBuddyStatusAndAliases,
} from "../types/workbuddy";
import {
  mapAccount,
  mapAlias,
  mapAuthStage,
  mapMailboxStatus,
  mapMessageDetail,
  mapMessageList,
  mapQuota,
  mapStatusAndAliases,
} from "./workBuddyMappers";

function ensureDesktop() {
  if (!isWailsDesktop()) {
    throw new Error(
      "[ERR_WB_GATEWAY_FAILED] 请在 OmniMail 桌面客户端中连接 WorkBuddy 邮箱",
    );
  }
}

export const workBuddyMailApi = {
  async startAuth(baseUrl = ""): Promise<WorkBuddyAuthStart> {
    ensureDesktop();
    const d = await StartAuth(baseUrl);
    return {
      flowId: d.flowId ?? "",
      state: d.state ?? "",
      authUrl: d.authUrl ?? "",
      baseUrl: d.baseUrl ?? "",
    };
  },

  async pollAuthStatus(flowId: string): Promise<WorkBuddyAuthPoll> {
    if (!isWailsDesktop()) {
      return {
        flowId,
        stage: "idle",
        mailboxStatus: "not_bound",
        email: "",
        aliasId: "",
        aliases: [],
        uid: "",
      };
    }
    const d = await PollAuthStatus(flowId);
    return {
      flowId: d.flowId ?? flowId,
      stage: mapAuthStage(d.stage),
      mailboxStatus: mapMailboxStatus(d.mailboxStatus),
      email: d.email ?? "",
      aliasId: d.aliasId ?? "",
      aliases: (d.aliases ?? []).map(mapAlias),
      uid: d.uid ?? "",
      errorCode: d.errorCode || undefined,
      errorMessage: d.errorMessage || undefined,
    };
  },

  async cancelAuth(flowId: string): Promise<void> {
    if (isWailsDesktop()) await CancelAuth(flowId);
  },

  async connectAccount(
    flowId: string,
    name: string,
  ): Promise<WorkBuddyAccount> {
    ensureDesktop();
    return mapAccount(await ConnectAccount(flowId, name));
  },

  async disconnectAccount(accountId: string): Promise<void> {
    if (isWailsDesktop()) await DisconnectAccount(accountId);
  },

  async getStatusAndAliases(
    accountId = "",
  ): Promise<WorkBuddyStatusAndAliases> {
    if (!isWailsDesktop()) {
      return {
        accounts: [],
        mailboxStatus: "not_bound",
        aliases: [],
        primaryAliasId: "",
        primaryEmail: "",
        dailyQuota: EMPTY_DAILY_QUOTA,
      };
    }
    return mapStatusAndAliases(await GetStatusAndAliases(accountId));
  },

  async listMessages(
    accId: string,
    aliasId: string,
    dir: WorkBuddyDirection,
    cursor = "",
    limit = 50,
  ): Promise<WorkBuddyMessageList> {
    ensureDesktop();
    return mapMessageList(
      await ListMessages(accId, aliasId, dir, cursor, limit),
    );
  },

  async searchMessages(
    accId: string,
    aliasId: string,
    dir: WorkBuddyDirection,
    q: string,
    cursor = "",
    limit = 50,
  ): Promise<WorkBuddyMessageList> {
    ensureDesktop();
    return mapMessageList(
      await SearchMessages(accId, aliasId, dir, q, cursor, limit),
    );
  },

  async getMessageDetail(
    accId: string,
    aliasId: string,
    msgId: string,
  ): Promise<WorkBuddyMessageDetail> {
    ensureDesktop();
    return mapMessageDetail(await GetMessageDetail(accId, aliasId, msgId));
  },

  async markAsRead(
    accId: string,
    aliasId: string,
    msgId: string,
  ): Promise<void> {
    if (isWailsDesktop()) await MarkAsRead(accId, aliasId, msgId);
  },

  async deleteMessage(
    accId: string,
    aliasId: string,
    msgId: string,
    token = "",
  ): Promise<WorkBuddyDeleteResult> {
    ensureDesktop();
    const d = await DeleteMessage(accId, aliasId, msgId, token);
    return {
      messageId: d.messageId ?? msgId,
      needsConfirmation: Boolean(d.needsConfirmation),
      confirmationToken: d.confirmationToken || undefined,
      deleted: Boolean(d.deleted),
      dailyQuota: mapQuota(d.dailyQuota),
    };
  },

  async saveAttachment(
    accId: string,
    aliasId: string,
    msgId: string,
    attId: string,
    dest = "",
  ): Promise<WorkBuddyAttachmentSaveResult> {
    ensureDesktop();
    const d = await SaveAttachment(accId, aliasId, msgId, attId, dest);
    return {
      saved: Boolean(d.saved),
      savedPath: d.savedPath ?? "",
      filename: d.filename ?? "",
      size: d.size ?? 0,
    };
  },
};
