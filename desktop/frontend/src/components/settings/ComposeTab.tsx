import { useApp } from "../../state/AppContext";
import { SwitchRow } from "./SwitchRow";

export function ComposeTab() {
  const { workspace, toastStore } = useApp();
  const s = workspace.settings;
  const activeAcc =
    workspace.accounts.find((a) => a.id === s.defaultSendAccountId) ??
    workspace.accounts[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>发件账户与安全防错</strong>
        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              新建邮件默认发件账户
            </div>
            <div className="text-xs text-muted">
              点击左侧「写邮件」时默认选中的身份
            </div>
          </div>
          <select
            className="select"
            value={s.defaultSendAccountId}
            onChange={(e) =>
              workspace.updateSettings({ defaultSendAccountId: e.target.value })
            }
          >
            {workspace.accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        </div>

        <SwitchRow
          title="回复邮件时锁定原收件账户"
          desc="工作邮件与个人邮件隔离回复，防止跨邮箱身份误发"
          checked={s.lockReplyToOriginalAccount}
          onChange={(v) =>
            workspace.updateSettings({ lockReplyToOriginalAccount: v })
          }
        />

        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              发送后撤销缓冲时长
            </div>
            <div className="text-xs text-muted">
              发送后在底部弹出撤销提示条，可在倒计时内撤回
            </div>
          </div>
          <select
            className="select"
            value={s.undoSendSeconds}
            onChange={(e) =>
              workspace.updateSettings({
                undoSendSeconds: Number(e.target.value) as 5 | 10 | 20,
              })
            }
          >
            <option value={5}>5 秒</option>
            <option value={10}>10 秒（默认）</option>
            <option value={20}>20 秒</option>
          </select>
        </div>
      </div>

      {activeAcc && (
        <div className="settings-card">
          <div className="row-between">
            <strong style={{ fontSize: 14 }}>
              默认账户邮件签名（{activeAcc.shortTag}）
            </strong>
            <SwitchRow
              title=""
              checked={s.autoAppendSignature}
              onChange={(v) =>
                workspace.updateSettings({ autoAppendSignature: v })
              }
            />
          </div>
          <textarea
            className="textarea"
            rows={4}
            value={activeAcc.signature}
            onChange={(e) =>
              workspace.updateAccount(activeAcc.id, {
                signature: e.target.value,
              })
            }
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ alignSelf: "flex-end" }}
            onClick={() =>
              toastStore.pushToast({ tone: "success", title: "签名配置已保存" })
            }
          >
            保存签名
          </button>
        </div>
      )}
    </div>
  );
}
