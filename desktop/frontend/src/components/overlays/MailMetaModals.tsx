import { useState } from "react";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

export function MailSourceModal({ mailId }: { mailId: string }) {
  const { workspace, mailStore, toastStore } = useApp();
  const mail =
    mailStore.mails.find((m) => m.id === mailId) ?? mailStore.selectedMail;
  const rawSource = [
    `Message-ID: <${mail?.id ?? "omni"}@mail.omnimail.example>`,
    `Date: ${mail?.fullTimeText ?? "2026-11-20 10:42"}`,
    `From: ${mail?.senderName ?? "发件人"} <${mail?.senderEmail ?? "sender@example.com"}>`,
    `To: ${mail?.recipients ?? "xinghe@studio.example"}`,
    `Subject: ${mail?.subject ?? ""}`,
    `Authentication-Results: spf=${mail?.securityWarning ? "fail" : "pass"}; dkim=${mail?.securityWarning ? "fail" : "pass"}; dmarc=${mail?.securityWarning ? "fail" : "pass"}`,
    `X-OmniMail-Account-Tag: ${mail?.accountTag ?? "工作 · Gmail"}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "",
    mail?.messages[0]?.bodyParagraphs.join("\n\n") ?? mail?.snippet ?? "",
  ].join("\n");

  return (
    <ModalShell
      title="查看原始邮件头与源码"
      subtitle="完整 RFC 5322 头部校验信息（已隐藏本机凭据字段）"
      maxWidth={680}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">
            可用于排查 SPF / DKIM / 路由延迟
          </span>
          <div className="row">
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
      <pre className="code-block">{rawSource}</pre>
    </ModalShell>
  );
}

export function PrintExportModal({ mailId }: { mailId: string }) {
  const { workspace, mailStore, toastStore } = useApp();
  const mail =
    mailStore.mails.find((m) => m.id === mailId) ?? mailStore.selectedMail;
  const [format, setFormat] = useState<"pdf" | "eml">("pdf");
  const [includeQuoted, setIncludeQuoted] = useState(true);

  return (
    <ModalShell
      title="打印与导出邮件"
      subtitle={mail?.subject ?? "当前邮件"}
      maxWidth={540}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">
            导出文件保留原始时间戳与邮件头
          </span>
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
              onClick={() => {
                workspace.setOverlay({ type: "none" });
                toastStore.pushToast({
                  tone: "success",
                  title:
                    format === "pdf"
                      ? "已生成 PDF 打印归档文件"
                      : "已导出标准 .eml 原始邮件文件",
                  detail: `${mail?.subject ?? "mail"}.${format}`,
                });
              }}
            >
              <Icon name="printer" size={14} /> 确认导出（.{format}）
            </button>
          </div>
        </>
      }
    >
      <div className="settings-card">
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className={`btn btn-sm ${format === "pdf" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setFormat("pdf")}
          >
            PDF 排版文档（适合打印归档）
          </button>
          <button
            type="button"
            className={`btn btn-sm ${format === "eml" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setFormat("eml")}
          >
            标准 .EML 文件（保留原始邮件头）
          </button>
        </div>

        <label className="row" style={{ fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={includeQuoted}
            onChange={(e) => setIncludeQuoted(e.target.checked)}
          />
          <span>包含同一会话下的历史往来邮件与附件清单</span>
        </label>
      </div>
    </ModalShell>
  );
}
