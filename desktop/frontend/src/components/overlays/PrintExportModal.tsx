import { useState } from "react";
import { mailApi, parseBackendError } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { Checkbox } from "../common/Checkbox";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

export function PrintExportModal({ mailId }: { mailId: string }) {
  const { workspace, mailStore, toastStore } = useApp();
  const mail =
    mailStore.mails.find((m) => m.id === mailId) ?? mailStore.selectedMail;
  const [format, setFormat] = useState<"pdf" | "eml">("eml");
  const [includeQuoted, setIncludeQuoted] = useState(true);

  const handleConfirm = async () => {
    if (format === "pdf") {
      workspace.setOverlay({ type: "none" });
      window.setTimeout(() => window.print(), 120);
      return;
    }
    try {
      const saved = await mailApi.exportMessageEML(mailId);
      workspace.setOverlay({ type: "none" });
      if (saved) {
        toastStore.pushToast({
          tone: "success",
          title: "已导出标准 .eml 原始邮件文件",
          detail: saved,
        });
      }
    } catch (err) {
      toastStore.pushToast({
        tone: "danger",
        title: "导出邮件失败",
        detail: parseBackendError(err).message,
      });
    }
  };

  return (
    <ModalShell
      heading="打印与导出邮件"
      subtitle={mail?.subject ?? "当前邮件"}
      maxWidth={540}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">
            原始 .eml 完整保留 DKIM 数字签名与头信息
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
              onClick={() => void handleConfirm()}
            >
              <Icon name="printer" size={14} />{" "}
              {format === "pdf" ? "调用系统打印 / PDF" : "导出原始 .eml"}
            </button>
          </div>
        </>
      }
    >
      <div className="settings-card">
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className={`btn btn-sm ${format === "eml" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setFormat("eml")}
          >
            标准 .EML 原始文件（100% 保真）
          </button>
          <button
            type="button"
            className={`btn btn-sm ${format === "pdf" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setFormat("pdf")}
          >
            排版打印 / 导出 PDF
          </button>
        </div>
        <Checkbox
          checked={includeQuoted}
          onChange={setIncludeQuoted}
          ariaLabel="包含同一会话下的历史往来邮件与附件清单"
        >
          打印时包含同一会话下的历史往来邮件与附件清单
        </Checkbox>
      </div>
    </ModalShell>
  );
}
