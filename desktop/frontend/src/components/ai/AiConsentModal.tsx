import { useState } from "react";
import { useApp } from "../../state/AppContext";
import { profileApi } from "../../services/backendClient";
import type { MailAiAction } from "../../types/mailAi";
import { mailAiScope } from "./aiPrivacyScope";
import { Checkbox } from "../common/Checkbox";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

export function AiConsentModal({
  actionLabel,
  action,
  mailId,
  profileId,
}: {
  actionLabel: string;
  action: MailAiAction;
  mailId: string;
  profileId: string;
}) {
  const { workspace, mailStore, aiStore, toastStore } = useApp();
  const [rememberChoice, setRememberChoice] = useState(false);
  const mail = mailStore.selectedMail;
  const scope = mailAiScope(workspace.settings.aiIncludeSenderAndAttachments);
  const isChat = action.kind === "chat";
  const canConfirm =
    mail?.id === mailId &&
    workspace.activeProfileId === profileId &&
    workspace.settings.aiEnabled &&
    !aiStore.sensitive.has(mailId);

  const handleConfirm = () => {
    if (!mail || !canConfirm) return;
    workspace.setOverlay({ type: "none" });
    aiStore.runAction(mailId, action, true);
    if (rememberChoice) {
      const patch = { aiRequireConfirmEachTime: false };
      void profileApi
        .updateAppSettings(patch)
        .then(() => workspace.applySettingsFromBackend(patch))
        .catch(() =>
          toastStore.pushToast({
            tone: "warning",
            title: "未能记住授权偏好，之后仍会确认",
          }),
        );
    }
  };

  return (
    <ModalShell
      heading="发送前确认 Omni AI 数据范围"
      subtitle={`即将执行：${actionLabel} · 仅本次显式触发`}
      maxWidth={520}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              workspace.setOverlay({ type: "settings", tab: "ai" })
            }
          >
            前往 AI 设置
          </button>
          <div className="row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => workspace.setOverlay({ type: "none" })}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canConfirm}
              onClick={handleConfirm}
            >
              确认并发送给 AI
            </button>
          </div>
        </>
      }
    >
      <div className="settings-card">
        <div
          className="row"
          style={{ color: "var(--brand-ai)", fontWeight: 700 }}
        >
          <Icon name="shield" size={16} />
          <span>本次发送范围说明</span>
        </div>
        <ul
          style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.75 }}
        >
          <li>
            <strong>包含内容：</strong>
            {scope.mailContent}
            {isChat ? "、本次提问及同一数据范围下的近期问答" : ""}
          </li>
          <li>
            <strong>不会作为独立内容发送：</strong>
            {scope.notShared}
          </li>
          <li>
            <strong>当前模型：</strong>
            {workspace.settings.aiProvider}（{workspace.settings.aiModel}）
          </li>
        </ul>
      </div>

      <Checkbox
        checked={rememberChoice}
        onChange={setRememberChoice}
        ariaLabel="记住本次选择"
      >
        记住本次选择，后续触发 AI 动作不再每次弹窗确认（可随时在设置中重新开启）
      </Checkbox>
    </ModalShell>
  );
}
