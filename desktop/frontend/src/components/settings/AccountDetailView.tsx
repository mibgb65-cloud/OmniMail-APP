import { useState } from "react";
import { accountApi, parseBackendError } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import {
  AsyncActionButton,
  type AsyncActionStatus,
} from "../common/AsyncActionButton";
import { Icon } from "../common/Icon";
import { ProviderIcon } from "../common/ProviderIcon";

export function AccountDetailView({
  accountId,
  onBack,
}: {
  accountId: string;
  onBack: () => void;
}) {
  const { workspace, toastStore } = useApp();
  const detail = workspace.accounts.find((a) => a.id === accountId);
  const [senderName, setSenderName] = useState(detail?.senderName ?? "");
  const [replyTo, setReplyTo] = useState(detail?.replyTo ?? "");
  const [signature, setSignature] = useState(detail?.signature ?? "");
  const [saveStatus, setSaveStatus] = useState<AsyncActionStatus>("idle");

  if (!detail) return null;

  const saveMeta = async () => {
    setSaveStatus("loading");
    try {
      const updated = await accountApi.updateAccount({
        id: detail.id,
        senderName,
        replyTo,
        signature,
      });
      workspace.updateAccount(detail.id, updated);
      setSaveStatus("success");
      toastStore.pushToast({
        tone: "success",
        title: "已保存发件身份与签名配置",
      });
    } catch (err) {
      setSaveStatus("error");
      toastStore.pushToast({
        tone: "danger",
        title: parseBackendError(err).message,
      });
    }
  };
  const makeDefault = async () => {
    try {
      await accountApi.setDefaultAccount(detail.id);
      workspace.updateSettings({ defaultSendAccountId: detail.id });
      await workspace.refreshProfilesAndAccounts();
      toastStore.pushToast({ tone: "success", title: "已设为默认发件邮箱" });
    } catch (err) {
      toastStore.pushToast({
        tone: "danger",
        title: parseBackendError(err).message,
      });
    }
  };
  const statusMeta =
    detail.status === "connected"
      ? { tone: "pill-success", text: "连接正常" }
      : detail.status === "auth-expired"
        ? { tone: "pill-danger", text: "授权已失效" }
        : { tone: "pill-warning", text: "同步中" };
  const openOverlay = workspace.setOverlay;
  const isDefault = workspace.settings.defaultSendAccountId === detail.id;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="row-between">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          <Icon name="arrowLeft" size={14} /> 返回邮箱账户列表
        </button>
        {!isDefault && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void makeDefault()}
          >
            设为默认发件邮箱
          </button>
        )}
      </div>

      <div className="settings-card">
        <div className="row-between">
          <div className="row" style={{ gap: 12 }}>
            <ProviderIcon provider={detail.provider} size={36} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{detail.name}</div>
              <div className="text-xs text-muted">{detail.email}</div>
            </div>
          </div>
          <span className={`pill ${statusMeta.tone}`}>{statusMeta.text}</span>
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div>
            <label className="text-xs text-muted">发件显示名称</label>
            <input
              className="input"
              style={{ marginTop: 4 }}
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted">默认回复地址</label>
            <input
              className="input"
              style={{ marginTop: 4 }}
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder={detail.email}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted">邮箱签名模板</label>
          <textarea
            className="textarea"
            rows={3}
            style={{ marginTop: 4 }}
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
          />
        </div>

        <div className="row-between">
          <div className="text-xs text-muted">
            IMAP: {detail.imap.host}:{detail.imap.port} · SMTP:{" "}
            {detail.smtp.host}:{detail.smtp.port}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                openOverlay({ type: "account-server", accountId: detail.id })
              }
            >
              编辑服务器参数
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                openOverlay({ type: "diagnostics", accountId: detail.id })
              }
            >
              连接诊断
            </button>
            <AsyncActionButton
              size="sm"
              status={saveStatus}
              idleLabel="保存身份与签名"
              loadingLabel="正在保存…"
              successLabel="身份与签名已保存"
              errorLabel="保存失败 · 重试"
              onSuccessHoldEnd={() => setSaveStatus("idle")}
              onClick={() => void saveMeta()}
            />
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="row-between">
          <div>
            <strong style={{ fontSize: 13, color: "var(--status-danger)" }}>
              移除此邮箱账户
            </strong>
            <div className="text-xs text-muted">
              仅清理本地缓存、索引与 DPAPI 凭据盒令牌，不删除远程邮局邮件
            </div>
          </div>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() =>
              openOverlay({
                type: "danger-confirm",
                kind: "remove-account",
                targetId: detail.id,
                targetLabel: detail.name,
              })
            }
          >
            移除账户
          </button>
        </div>
      </div>
    </div>
  );
}
