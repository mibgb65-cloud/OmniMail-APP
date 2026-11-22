import { useApp } from "../../state/AppContext";
import type { DangerConfirmKind } from "../../types/ui";
import { ModalShell } from "../common/ModalShell";

const DANGER_META: Record<
  DangerConfirmKind,
  {
    title: string;
    desc: string;
    confirmText: string;
    tone: "danger" | "primary";
  }
> = {
  "remove-account": {
    title: "确认移除该邮箱账户？",
    desc: "将删除本地缓存、索引与凭据库中的授权令牌，但不会删除远程邮箱服务器上的原始邮件。",
    confirmText: "确认移除账户",
    tone: "danger",
  },
  "empty-trash": {
    title: "确认清空回收站？",
    desc: "回收站中的所有邮件将被永久删除且无法恢复，请确认是否继续。",
    confirmText: "永久清空回收站",
    tone: "danger",
  },
  "permanent-delete": {
    title: "确认永久删除所选邮件？",
    desc: "该操作不可撤销，邮件及本地缓存副本将被彻底清除。",
    confirmText: "永久删除",
    tone: "danger",
  },
  "discard-draft": {
    title: "确认放弃并删除当前草稿？",
    desc: "尚未发送的正文与草稿附件配置将被丢弃。",
    confirmText: "删除草稿",
    tone: "danger",
  },
  "delete-label": {
    title: "确认删除该自定义标签？",
    desc: "仅从邮件上移除标签标记，不会删除任何邮件正文。",
    confirmText: "删除标签",
    tone: "danger",
  },
  "wipe-local-data": {
    title: "确认清除全部本地数据并重置应用？",
    desc: "将清空所有本地缓存、规则、联系人与账户配置，并返回首次使用引导页（不影响云端邮件）。",
    confirmText: "确认彻底重置",
    tone: "danger",
  },
  "no-subject-send": {
    title: "当前邮件未填写主题，确认继续发送？",
    desc: "补充清晰主题有助于收件人快速识别邮件内容。你也可以直接发送无主题邮件。",
    confirmText: "仍然发送",
    tone: "primary",
  },
};

export function DangerConfirmModal({
  kind,
  targetId,
  targetLabel,
}: {
  kind: DangerConfirmKind;
  targetId?: string;
  targetLabel?: string;
}) {
  const { workspace, mailStore, composeStore, toastStore, sendMailWithUndo } =
    useApp();
  const meta = DANGER_META[kind];

  const handleConfirm = () => {
    if (kind === "remove-account" && targetId) {
      workspace.removeAccount(targetId);
      toastStore.pushToast({
        tone: "warning",
        title: `已移除邮箱账户：${targetLabel ?? targetId}`,
      });
    } else if (kind === "empty-trash") {
      mailStore.emptyTrash();
      toastStore.pushToast({ tone: "warning", title: "回收站已彻底清空" });
    } else if (kind === "permanent-delete" && targetId) {
      mailStore.permanentDelete(targetId.split(","));
      toastStore.pushToast({ tone: "warning", title: "已永久删除所选邮件" });
    } else if (kind === "discard-draft") {
      composeStore.closeDraft();
      toastStore.pushToast({ tone: "info", title: "草稿已删除" });
    } else if (kind === "delete-label" && targetId) {
      mailStore.deleteLabel(targetId);
      toastStore.pushToast({
        tone: "info",
        title: `已删除标签「${targetLabel ?? ""}」`,
      });
    } else if (kind === "wipe-local-data") {
      workspace.resetLocalData();
      toastStore.pushToast({ tone: "warning", title: "已清除全部本地数据" });
    } else if (kind === "no-subject-send" && composeStore.draft) {
      const d = composeStore.draft;
      sendMailWithUndo({
        accountId: d.accountId,
        to: d.to,
        subject: "（无主题）",
        body: d.body,
        scheduledAt: d.scheduledAt,
      });
      composeStore.closeDraft();
    }
    workspace.setOverlay({ type: "none" });
  };

  return (
    <ModalShell
      title={meta.title}
      subtitle={targetLabel ? `目标：${targetLabel}` : undefined}
      maxWidth={460}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <div className="row" style={{ marginLeft: "auto" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => workspace.setOverlay({ type: "none" })}
          >
            取消
          </button>
          <button
            type="button"
            className={`btn ${meta.tone === "danger" ? "btn-danger" : "btn-primary"}`}
            onClick={handleConfirm}
          >
            {meta.confirmText}
          </button>
        </div>
      }
    >
      <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-body)" }}>
        {meta.desc}
      </div>
    </ModalShell>
  );
}
