import { composeApi, parseBackendError } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { isWailsDesktop } from "../../state/storageHelpers";
import { CustomSelect } from "../common/CustomSelect";
import { Icon } from "../common/Icon";
import { ProviderIcon } from "../common/ProviderIcon";
import { buildDemoDraftAttachment } from "./ComposeAttachmentsBar";
import { RecipientInputRow } from "./RecipientInputRow";

export function ComposeHeaderFields() {
  const { workspace, composeStore, toastStore } = useApp();
  const draft = composeStore.draft;
  if (!draft) return null;

  return (
    <>
      <div className="compose-row">
        <span className="compose-row-label">发件人</span>
        <div className="row" style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <CustomSelect
            compact
            value={draft.accountId}
            disabled={draft.lockedAccount}
            ariaLabel="选择发件账户"
            minMenuWidth={280}
            style={{ flex: 1, maxWidth: 340 }}
            onChange={(val) => composeStore.updateDraft({ accountId: val })}
            options={workspace.accounts.map((acc) => ({
              value: acc.id,
              label: acc.name,
              sublabel: acc.email,
              icon: <ProviderIcon provider={acc.provider} size={18} />,
            }))}
          />
          {draft.lockedAccount && (
            <>
              <span className="pill pill-accent">
                <Icon name="lock" size={12} /> 已锁定原收件账户
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  composeStore.updateDraft({
                    lockedAccount: false,
                    unlockIdentity: true,
                  });
                  toastStore.pushToast({
                    tone: "info",
                    title: "已临时解锁发件身份限制，请留意避免误发",
                  });
                }}
              >
                临时切换
              </button>
            </>
          )}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() =>
            composeStore.updateDraft({ showCcBcc: !draft.showCcBcc })
          }
        >
          {draft.showCcBcc ? "隐藏抄送/密送" : "抄送 / 密送"}
        </button>
      </div>

      <RecipientInputRow
        label="收件人"
        values={draft.to}
        contacts={workspace.contacts}
        onChange={(next) => composeStore.updateDraft({ to: next })}
      />

      {draft.showCcBcc && (
        <>
          <RecipientInputRow
            label="抄送"
            values={draft.cc}
            contacts={workspace.contacts}
            onChange={(next) => composeStore.updateDraft({ cc: next })}
          />
          <RecipientInputRow
            label="密送"
            values={draft.bcc}
            contacts={workspace.contacts}
            onChange={(next) => composeStore.updateDraft({ bcc: next })}
          />
        </>
      )}

      <div className="compose-row">
        <span className="compose-row-label">主题</span>
        <input
          type="text"
          value={draft.subject}
          onChange={(e) =>
            composeStore.updateDraft({ subject: e.target.value })
          }
          placeholder="请输入邮件主题…"
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            outline: "none",
            color: "var(--text-ink)",
            fontSize: 14,
            fontWeight: 600,
          }}
        />
        {draft.scheduledAt && (
          <span className="pill pill-accent">定时 · {draft.scheduledAt}</span>
        )}
      </div>
    </>
  );
}

export function ComposeToolbar() {
  const { workspace, composeStore, toastStore } = useApp();
  const draft = composeStore.draft;
  if (!draft) return null;

  const handlePickAttachments = () => {
    if (!isWailsDesktop()) {
      composeStore.updateDraft({
        attachments: [...draft.attachments, buildDemoDraftAttachment(false)],
      });
      return;
    }
    void composeApi
      .pickAttachments()
      .then((picked) => {
        if (picked.length === 0) return;
        const merged = [...draft.attachments, ...picked];
        const totalBytes = merged.reduce((s, a) => s + (a.sizeBytes ?? 0), 0);
        if (totalBytes > 25 * 1024 * 1024) {
          toastStore.pushToast({
            tone: "warning",
            title: "附件总大小已超过 25 MB",
            detail: "部分邮局 SMTP 可能拒收超大附件，建议压缩或分批发送",
          });
        }
        composeStore.updateDraft({ attachments: merged });
      })
      .catch((err) =>
        toastStore.pushToast({
          tone: "danger",
          title: "读取本地附件失败",
          detail: parseBackendError(err).message,
        }),
      );
  };

  return (
    <div className="compose-toolbar">
      <div className="row" style={{ gap: 4, minWidth: 0 }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={handlePickAttachments}
        >
          <Icon name="paperclip" size={13} /> 添加附件
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() =>
            workspace.setOverlay({
              type: "attachment-transfer",
              mode: "transfer",
            })
          }
        >
          传输队列
        </button>
      </div>
      <button
        type="button"
        className="btn btn-ai btn-sm"
        style={{ flexShrink: 0 }}
        onClick={() =>
          composeStore.updateDraft({ inlineAiOpen: !draft.inlineAiOpen })
        }
      >
        <Icon name="sparkle" size={13} />
        {draft.inlineAiOpen ? "收起 AI" : "Omni AI 起草"}
      </button>
    </div>
  );
}
