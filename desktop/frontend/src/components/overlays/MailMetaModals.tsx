import { useEffect, useState } from "react";
import {
  diagnosticApi,
  mailApi,
  type RawSourceView,
} from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { isWailsDesktop } from "../../state/storageHelpers";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

export { PrintExportModal } from "./PrintExportModal";

export function MailSourceModal({ mailId }: { mailId: string }) {
  const { workspace, mailStore, toastStore } = useApp();
  const [sourceView, setSourceView] = useState<RawSourceView | null>(null);
  const mail =
    mailStore.mails.find((m) => m.id === mailId) ?? mailStore.selectedMail;

  useEffect(() => {
    if (!isWailsDesktop() || !mailId) return;
    let active = true;
    void diagnosticApi
      .getMessageRawSource(mailId)
      .then((res) => {
        if (active && res) setSourceView(res);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [mailId]);

  const bodyTxt =
    mail?.messages[mail.messages.length - 1]?.bodyParagraphs.join("\n\n") ??
    mail?.snippet ??
    "";
  const fallbackRaw = mail?.rawHeaders
    ? `${mail.rawHeaders}\n\n${bodyTxt}`
    : `Subject: ${mail?.subject ?? ""}\nFrom: ${mail?.senderEmail ?? ""}\n\n${bodyTxt}`;
  const rawSource = sourceView?.rawSource || fallbackRaw;

  return (
    <ModalShell
      heading="查看原始邮件头与源码"
      subtitle="从本地 CAS .eml.zst 解压真实 RFC5322 源码与路由跳数"
      maxWidth={680}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">
            {sourceView?.truncated
              ? "已截断超长附件段，导出 .eml 可查看完整字节"
              : "可用于核查 SPF / DKIM / Received 跳数"}
          </span>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                void mailApi.exportMessageEML(mailId).then(
                  (p) =>
                    p &&
                    toastStore.pushToast({
                      tone: "success",
                      title: "已导出原始 .eml",
                      detail: p,
                    }),
                );
              }}
            >
              <Icon name="download" size={14} /> 导出 .eml
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(rawSource);
                toastStore.pushToast({
                  tone: "success",
                  title: "已复制邮件原始源码",
                });
              }}
            >
              <Icon name="copy" size={14} /> 复制全文
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => workspace.setOverlay({ type: "none" })}
            >
              关闭
            </button>
          </div>
        </>
      }
    >
      {sourceView && (
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          <span className="pill pill-neutral">SPF: {sourceView.spf}</span>
          <span className="pill pill-neutral">DKIM: {sourceView.dkim}</span>
          <span className="pill pill-neutral">DMARC: {sourceView.dmarc}</span>
          <span className="pill pill-neutral">
            路由跳数: {sourceView.hops?.length ?? 0} 跳
          </span>
        </div>
      )}
      <pre className="code-block" style={{ maxHeight: 360 }}>
        {rawSource}
      </pre>
    </ModalShell>
  );
}
