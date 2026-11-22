import { useApp } from "../../state/AppContext";
import type { AttachmentItem } from "../../types/mail";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

export function AttachmentPreviewModal({
  attachment,
  mailSubject,
}: {
  attachment: AttachmentItem;
  mailSubject: string;
}) {
  const { workspace, toastStore } = useApp();

  return (
    <ModalShell
      title={attachment.name}
      subtitle={`${attachment.sizeText} · 来自《${mailSubject}》`}
      maxWidth={680}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">
            本地沙箱只读预览 · 附件未发送给 Omni AI
          </span>
          <div className="row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => workspace.setOverlay({ type: "none" })}
            >
              关闭
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                toastStore.pushToast({
                  tone: "success",
                  title: `已开始下载 ${attachment.name}`,
                  detail: `文件大小 ${attachment.sizeText} · 保存至默认下载目录`,
                })
              }
            >
              <Icon name="download" size={14} /> 下载原文件
            </button>
          </div>
        </>
      }
    >
      {attachment.kind === "pdf" && (
        <div className="settings-card" style={{ minHeight: 300, gap: 14 }}>
          <div className="row-between">
            <span className="pill pill-accent">PDF 文档预览 · 第 1 / 8 页</span>
            <span className="text-xs text-muted">缩放 100%</span>
          </div>
          <div
            style={{
              flex: 1,
              padding: 20,
              borderRadius: 10,
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              lineHeight: 1.8,
              fontSize: 13,
            }}
          >
            <strong style={{ fontSize: 15 }}>
              OmniMail 0.1 产品架构与交互边界规范
            </strong>
            <p style={{ margin: "10px 0 0", color: "var(--text-body)" }}>
              1.
              统一收件箱默认按时间倒序汇总所有接入账户，并在列表卡片与阅读区显式标记来源邮箱。
              <br />
              2. 回复工作与个人邮件时自动锁定原收件账户，杜绝跨身份误发。
              <br />
              3. Omni AI 保持独立右侧浮层卡片，严格执行「仅发送当前正文 ·
              地址与附件不外传」。
            </p>
          </div>
        </div>
      )}

      {attachment.kind === "image" && (
        <div
          className="settings-card"
          style={{
            minHeight: 280,
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
            color: "#F8FAFC",
          }}
        >
          <Icon name="image" size={40} />
          <strong>{attachment.name}</strong>
          <span className="text-xs" style={{ opacity: 0.78 }}>
            高分视觉预览画板 · 1728 × 1080 PNG
          </span>
        </div>
      )}

      {attachment.kind !== "pdf" && attachment.kind !== "image" && (
        <div
          className="settings-card"
          style={{ alignItems: "center", padding: 32, textAlign: "center" }}
        >
          <Icon name="file" size={34} />
          <strong>暂不支持直接在线预览该文件格式</strong>
          <div className="text-xs text-muted">
            为保障安全，压缩包、日历文件或二进制文档请下载后由本机应用校验并打开。
          </div>
        </div>
      )}
    </ModalShell>
  );
}

export function AttachmentTransferModal({
  mode,
}: {
  mode: "transfer" | "oversized";
}) {
  const { workspace, toastStore } = useApp();

  return (
    <ModalShell
      title={
        mode === "oversized" ? "附件大小超出服务商限制" : "附件传输与下载队列"
      }
      subtitle="支持断点续传、失败重试与大附件压缩提示"
      maxWidth={540}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">单封邮件常规上限：25 MB</span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => workspace.setOverlay({ type: "none" })}
          >
            完成
          </button>
        </>
      }
    >
      <div className="settings-card">
        <div className="row-between">
          <strong>OmniMail-设计走查录屏-28MB.mp4</strong>
          <span className="pill pill-danger">超出 25 MB 上限</span>
        </div>
        <div className="text-xs text-muted">
          当前文件 28.4 MB，超过 Gmail / Outlook 常规 SMTP
          单封限制。建议压缩后再发送或改为网盘分享链接。
        </div>
        <div className="row">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              toastStore.pushToast({
                tone: "success",
                title: "已生成压缩副本（11.2 MB）并重新加入草稿",
              })
            }
          >
            自动压缩至 11.2 MB
          </button>
        </div>
      </div>

      <div className="settings-card">
        <div className="row-between">
          <strong>OmniMail-0.1-设计规格书.pdf</strong>
          <span className="pill pill-success">已缓存 100%</span>
        </div>
        <div className="storage-bar">
          <div style={{ width: "100%", background: "var(--status-success)" }} />
        </div>
        <div className="text-xs text-muted">2.4 MB · 校验 SHA-256 通过</div>
      </div>
    </ModalShell>
  );
}
