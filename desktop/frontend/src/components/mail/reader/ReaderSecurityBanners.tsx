import { mailApi, parseBackendError } from "../../../services/backendClient";
import { useApp } from "../../../state/AppContext";
import type { MailItem } from "../../../types/mail";
import { Icon } from "../../common/Icon";
import { ReaderOutboxBanners } from "./ReaderOutboxBanners";

export function ReaderSecurityBanners({ mail }: { mail: MailItem }) {
  const { workspace, mailStore, toastStore } = useApp();

  return (
    <>
      <ReaderOutboxBanners mail={mail} />

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
                mailStore.moveMails([mail.id], "spam");
                toastStore.pushToast({
                  tone: "info",
                  title: "已将可疑邮件移入垃圾邮件箱",
                });
              }}
            >
              移入垃圾邮件
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => {
                workspace.addBlacklist({
                  target: mail.senderEmail,
                  kind: "address",
                  reason: "高危钓鱼邮件一键拉黑",
                  blockedCount: 0,
                  addedAt: "今天",
                });
                mailStore.moveMails([mail.id], "spam");
                toastStore.pushToast({
                  tone: "warning",
                  title: `已拉黑 ${mail.senderEmail} 并移入垃圾箱`,
                });
              }}
            >
              拉黑发件人
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
              <strong>已拦截远程图片与外部追踪像素</strong> ·
              默认不自动加载外部资源。
            </span>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => {
              void mailApi
                .allowRemoteImages(mail.id)
                .then((restoredHtml) => {
                  mailStore.updateMail(mail.id, {
                    remoteImagesAllowed: true,
                    messages: mail.messages.map((msg, idx) =>
                      idx === mail.messages.length - 1 && restoredHtml
                        ? { ...msg, bodyHtml: restoredHtml }
                        : msg,
                    ),
                  });
                  toastStore.pushToast({
                    tone: "info",
                    title: "已允许并加载此邮件的远程图片",
                  });
                })
                .catch((err) =>
                  toastStore.pushToast({
                    tone: "danger",
                    title: "无法加载外链图片",
                    detail: parseBackendError(err).message,
                  }),
                );
            }}
          >
            显示此邮件图片
          </button>
        </div>
      )}
    </>
  );
}
