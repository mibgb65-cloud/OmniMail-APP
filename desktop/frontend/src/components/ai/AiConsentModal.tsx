import { useState } from "react";
import { useApp } from "../../state/AppContext";
import { Checkbox } from "../common/Checkbox";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

export function AiConsentModal({
  actionLabel,
  onConfirmPrompt,
}: {
  actionLabel: string;
  onConfirmPrompt?: string;
}) {
  const { workspace, mailStore, aiStore, toastStore } = useApp();
  const [rememberChoice, setRememberChoice] = useState(false);
  const mail = mailStore.selectedMail;

  const handleConfirm = () => {
    if (rememberChoice) {
      workspace.updateSettings({ aiRequireConfirmEachTime: false });
    }
    workspace.setOverlay({ type: "none" });
    if (mail && onConfirmPrompt) {
      aiStore.runPrompt(mail, onConfirmPrompt);
    } else {
      toastStore.pushToast({
        tone: "info",
        title: `已授权执行「${actionLabel}」`,
        detail: "仅发送当前邮件正文，未包含收件人地址与附件",
      });
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
            <strong>包含内容：</strong>当前邮件主题《
            {mail?.subject ?? "当前草稿"}》及纯文本正文
          </li>
          <li>
            <strong>不会外传：</strong>
            发件人/收件人邮箱地址、本地附件原文件、其他邮箱文件夹数据
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
