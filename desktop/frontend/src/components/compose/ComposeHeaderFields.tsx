import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { ProviderIcon } from "../common/ProviderIcon";
import { RecipientInputRow } from "./RecipientInputRow";

export function ComposeHeaderFields() {
  const { workspace, composeStore } = useApp();
  const draft = composeStore.draft;
  if (!draft) return null;

  const currentAccount =
    workspace.accounts.find((a) => a.id === draft.accountId) ??
    workspace.accounts[0];

  return (
    <>
      <div className="compose-row">
        <span className="compose-row-label">发件人</span>
        <div className="row" style={{ flex: 1, minWidth: 0 }}>
          {currentAccount && (
            <ProviderIcon provider={currentAccount.provider} size={18} />
          )}
          <select
            className="select truncate"
            style={{ height: 28, flex: 1, minWidth: 0, maxWidth: 340 }}
            value={draft.accountId}
            disabled={draft.lockedAccount}
            onChange={(e) =>
              composeStore.updateDraft({ accountId: e.target.value })
            }
          >
            {workspace.accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}（{acc.email}）
              </option>
            ))}
          </select>
          {draft.lockedAccount && (
            <span className="pill pill-accent">
              <Icon name="lock" size={12} /> 已锁定原收件账户
            </span>
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
