import { useApp } from "../../../state/AppContext";
import type { MailItem } from "../../../types/mail";
import { Icon } from "../../common/Icon";

export function ReaderSecurityBanners({ mail }: { mail: MailItem }) {
  const { workspace, mailStore, toastStore } = useApp();

  return (
    <>
      {mail.securityWarning && (
        <div className="security-banner danger" role="alert">
          <div style={{ display: "flex", gap: 10 }}>
            <Icon name="shield" size={18} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <strong>{mail.securityWarning.title}</strong>
              <span style={{ fontSize: 12, lineHeight: 1.5 }}>
                {mail.securityWarning.detail}
              </span>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: 2,
                  flexWrap: "wrap",
                }}
              >
                <span className="pill pill-danger">
                  SPF: {mail.securityWarning.spf}
                </span>
                <span className="pill pill-danger">
                  DKIM: {mail.securityWarning.dkim}
                </span>
                <span className="pill pill-danger">
                  DMARC: {mail.securityWarning.dmarc}
                </span>
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => {
                mailStore.moveMails([mail.id], "trash");
                toastStore.pushToast({
                  tone: "info",
                  title: "已举报钓鱼并将邮件移入回收站",
                });
              }}
            >
              举报并删除
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() =>
                workspace.setOverlay({ type: "mail-source", mailId: mail.id })
              }
            >
              查看原始邮件头
            </button>
          </div>
        </div>
      )}

      {mail.hasRemoteImages && !mail.remoteImagesAllowed && (
        <div className="security-banner warning" role="status">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="image" size={16} />
            <span>
              <strong>已拦截远程图片与外部追踪像素</strong> · 为保护你的 IP
              与阅读隐私，默认不加载远程图片。
            </span>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => {
                mailStore.updateMail(mail.id, { remoteImagesAllowed: true });
                toastStore.pushToast({
                  tone: "info",
                  title: "仅本次已加载该邮件远程图片",
                });
              }}
            >
              仅本次加载
            </button>
          </div>
        </div>
      )}

      {mail.outboxError && (
        <div className="security-banner danger" role="alert">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="alertCircle" size={16} />
            <span>
              <strong>发送失败：</strong>
              {mail.outboxError}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => {
                mailStore.moveMails([mail.id], "sent", {
                  outboxError: undefined,
                  statusBadge: undefined,
                });
                toastStore.pushToast({
                  tone: "success",
                  title: "重试成功，邮件已发送",
                });
              }}
            >
              立即重试发送
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() =>
                workspace.setOverlay({
                  type: "diagnostics",
                  accountId: mail.accountId,
                })
              }
            >
              连接诊断
            </button>
          </div>
        </div>
      )}
    </>
  );
}
