import { t } from "../i18n";
import { parseBackendError, workBuddyMailApi } from "../services/backendClient";
import {
  markMessageReadInList,
  removeDeletedMessageFromState,
  type WorkBuddyAccount,
  type WorkBuddyAttachmentMeta,
  type WorkBuddyDirection,
} from "../types/workbuddy";
import {
  resetAllWorkBuddyState,
  type PendingDeleteTarget,
  type WorkBuddyStateMutators,
  type WorkBuddyToastFn,
} from "./useWorkBuddyState";

export {
  resetAllWorkBuddyState,
  type PendingDeleteTarget,
  type WorkBuddyStateMutators,
  type WorkBuddyToastFn,
};

export async function runFetchMessagesPage(
  m: WorkBuddyStateMutators,
  p: {
    account: WorkBuddyAccount;
    dir: WorkBuddyDirection;
    query: string;
    cursor: string;
    append: boolean;
  },
) {
  const seq = m.bumpSeq();
  if (p.append) m.setLoadingMore(true);
  else {
    m.setListLoading(true);
    m.setActiveError(null);
  }
  try {
    const q = p.query.trim();
    const accId = p.account.accountId;
    const alId = p.account.aliasId;
    const res = q
      ? await workBuddyMailApi.searchMessages(accId, alId, p.dir, q, p.cursor)
      : await workBuddyMailApi.listMessages(accId, alId, p.dir, p.cursor);
    if (m.getSeq() !== seq) return;
    if (res.dailyQuota.hasQuota) m.setDailyQuota(res.dailyQuota);
    m.setLastSyncedAt(Date.now());
    m.setNextCursor(res.nextCursor);
    m.setHasMore(res.hasMore);
    if (p.append) {
      m.setMessages((prev) => {
        const seen = new Set(prev.map((x) => x.messageId));
        return [...prev, ...res.items.filter((x) => !seen.has(x.messageId))];
      });
    } else {
      m.setMessages(res.items);
      const firstId = res.items[0]?.messageId ?? "";
      m.setSelectedMessageId(firstId);
      if (!firstId) m.setMessageDetail(null);
    }
  } catch (err) {
    if (m.getSeq() === seq) m.setActiveError(parseBackendError(err));
  } finally {
    if (m.getSeq() === seq) {
      m.setListLoading(false);
      m.setLoadingMore(false);
    }
  }
}

export async function runSelectAndMarkRead(
  m: WorkBuddyStateMutators,
  acc: WorkBuddyAccount,
  msgId: string,
  wasUnread: boolean,
) {
  const dSeq = m.bumpDetailSeq();
  m.setSelectedMessageId(msgId);
  m.setDetailLoading(true);
  if (wasUnread) m.setMessages((prev) => markMessageReadInList(prev, msgId));
  try {
    const detail = await workBuddyMailApi.getMessageDetail(
      acc.accountId,
      acc.aliasId,
      msgId,
    );
    if (m.getDetailSeq() !== dSeq) return;
    const needsMark = wasUnread || !detail.isRead;
    m.setMessageDetail({ ...detail, isRead: true });
    if (detail.dailyQuota.hasQuota) m.setDailyQuota(detail.dailyQuota);
    if (needsMark) {
      m.setMessages((prev) => markMessageReadInList(prev, msgId));
      void workBuddyMailApi
        .markAsRead(acc.accountId, acc.aliasId, msgId)
        .catch(() => undefined);
    }
  } catch (err) {
    if (m.getDetailSeq() === dSeq) m.setActiveError(parseBackendError(err));
  } finally {
    if (m.getDetailSeq() === dSeq) m.setDetailLoading(false);
  }
}

export async function runTwoStepDelete(
  m: WorkBuddyStateMutators,
  acc: WorkBuddyAccount,
  target: PendingDeleteTarget,
  selectedId: string,
  pushToast: WorkBuddyToastFn,
) {
  m.setDeleting(true);
  try {
    let tok = target.confirmationToken;
    if (!tok) {
      const s1 = await workBuddyMailApi.deleteMessage(
        acc.accountId,
        acc.aliasId,
        target.messageId,
        "",
      );
      if (s1.deleted) {
        finalizeDeleted(m, target.messageId, selectedId, pushToast);
        return;
      }
      tok = s1.confirmationToken ?? "";
    }
    const s2 = await workBuddyMailApi.deleteMessage(
      acc.accountId,
      acc.aliasId,
      target.messageId,
      tok,
    );
    if (s2.dailyQuota.hasQuota) m.setDailyQuota(s2.dailyQuota);
    finalizeDeleted(m, target.messageId, selectedId, pushToast);
  } catch (err) {
    pushToast({ tone: "danger", title: parseBackendError(err).message });
  } finally {
    m.setDeleting(false);
  }
}

function finalizeDeleted(
  m: WorkBuddyStateMutators,
  deletedId: string,
  selectedId: string,
  pushToast: WorkBuddyToastFn,
) {
  m.setPendingDelete(null);
  m.setMessages((prev) => {
    const next = removeDeletedMessageFromState(prev, selectedId, deletedId);
    m.setSelectedMessageId(next.nextSelectedId);
    if (!next.nextSelectedId) m.setMessageDetail(null);
    return next.items;
  });
  pushToast({ tone: "success", title: t("workbuddy.deletedToast") });
}

export async function runSaveAttachment(
  m: WorkBuddyStateMutators,
  acc: WorkBuddyAccount,
  msgId: string,
  att: WorkBuddyAttachmentMeta,
  pushToast: WorkBuddyToastFn,
) {
  m.setSavingAttachmentId(att.attachmentId);
  try {
    const res = await workBuddyMailApi.saveAttachment(
      acc.accountId,
      acc.aliasId,
      msgId,
      att.attachmentId,
    );
    if (res.saved) {
      pushToast({
        tone: "success",
        title: t("workbuddy.attachmentSavedToast", {
          filename: res.filename || att.filename,
        }),
      });
    }
  } catch (err) {
    pushToast({ tone: "danger", title: parseBackendError(err).message });
  } finally {
    m.setSavingAttachmentId("");
  }
}
