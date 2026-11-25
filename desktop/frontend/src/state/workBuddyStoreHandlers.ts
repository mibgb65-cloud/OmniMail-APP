import { parseBackendError, workBuddyMailApi } from "../services/backendClient";
import type { WorkspaceScreen } from "../types/ui";
import {
  markMessageReadInList,
  type WorkBuddyAccount,
  type WorkBuddyAttachmentMeta,
  type WorkBuddyDirection,
} from "../types/workbuddy";
import {
  resetAllWorkBuddyState,
  type useWorkBuddyStateCells,
  type WorkBuddyToastFn,
} from "./useWorkBuddyState";
import {
  runFetchMessagesPage,
  runSaveAttachment,
  runSelectAndMarkRead,
  runTwoStepDelete,
} from "./workBuddyStoreActions";

export function createWorkBuddyHandlers(
  s: ReturnType<typeof useWorkBuddyStateCells>,
  activeAccount: WorkBuddyAccount | undefined,
  screen: WorkspaceScreen,
  setScreen: (next: WorkspaceScreen) => void,
  pushToast: WorkBuddyToastFn,
) {
  const { mutators: m } = s;

  return {
    setDir: (next: WorkBuddyDirection) => {
      if (next !== s.dir) {
        m.setMessages([]);
        m.setSelectedMessageId("");
        m.setMessageDetail(null);
        s.setDir(next);
      }
    },
    cancelDelete: () => m.setPendingDelete(null),
    refreshMessages: () =>
      activeAccount
        ? runFetchMessagesPage(m, {
            account: activeAccount,
            dir: s.dir,
            query: s.searchQuery,
            cursor: "",
            append: false,
          })
        : Promise.resolve(),
    loadMoreMessages: () =>
      activeAccount && s.hasMore && s.nextCursor && !s.loadingMore
        ? runFetchMessagesPage(m, {
            account: activeAccount,
            dir: s.dir,
            query: s.debouncedQuery,
            cursor: s.nextCursor,
            append: true,
          })
        : Promise.resolve(),
    selectMessage: (msgId: string) => {
      if (!activeAccount) return Promise.resolve();
      const item = s.messages.find((x) => x.messageId === msgId);
      return runSelectAndMarkRead(
        m,
        activeAccount,
        msgId,
        Boolean(item && !item.isRead),
      );
    },
    markCurrentRead: async () => {
      if (!activeAccount || !s.selectedMessageId) return;
      m.setMessages((prev) => markMessageReadInList(prev, s.selectedMessageId));
      m.setMessageDetail((prev) => (prev ? { ...prev, isRead: true } : prev));
      await workBuddyMailApi
        .markAsRead(
          activeAccount.accountId,
          activeAccount.aliasId,
          s.selectedMessageId,
        )
        .catch(() => undefined);
    },
    requestDelete: async (msgId: string, subject: string) => {
      if (!activeAccount) return;
      m.setPendingDelete({
        messageId: msgId,
        subject,
        confirmationToken: "",
        preparing: true,
      });
      try {
        const s1 = await workBuddyMailApi.deleteMessage(
          activeAccount.accountId,
          activeAccount.aliasId,
          msgId,
          "",
        );
        m.setPendingDelete((cur) =>
          cur && cur.messageId === msgId
            ? {
                ...cur,
                confirmationToken: s1.confirmationToken ?? "",
                preparing: false,
              }
            : cur,
        );
      } catch (err) {
        m.setPendingDelete(null);
        pushToast({ tone: "danger", title: parseBackendError(err).message });
      }
    },
    confirmDelete: () =>
      activeAccount && s.pendingDelete
        ? runTwoStepDelete(
            m,
            activeAccount,
            s.pendingDelete,
            s.selectedMessageId,
            pushToast,
          )
        : Promise.resolve(),
    saveAttachment: (att: WorkBuddyAttachmentMeta) =>
      activeAccount && s.selectedMessageId
        ? runSaveAttachment(
            m,
            activeAccount,
            s.selectedMessageId,
            att,
            pushToast,
          )
        : Promise.resolve(),
    resetForWorkspaceSwitch: () => resetAllWorkBuddyState(m, screen, setScreen),
  };
}
