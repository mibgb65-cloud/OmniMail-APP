import { useApp } from "../../state/AppContext";
import type { AiRunStatus } from "../../types/workspace";
import { Icon } from "../common/Icon";

const STATUS_META: Record<
  Exclude<AiRunStatus, "idle" | "processing">,
  {
    tone: "warning" | "danger";
    title: string;
    detail: string;
    actionLabel: string;
  }
> = {
  error: {
    tone: "danger",
    title: "AI 响应超时或网络波动",
    detail: "当前请求未能完成，你可以直接重试，邮件正文未保留在远端。",
    actionLabel: "重新尝试",
  },
  "invalid-key": {
    tone: "danger",
    title: "API 密钥无效或已过期",
    detail: "请前往「设置 → AI 助手」检查模型服务地址与密钥配置。",
    actionLabel: "打开 AI 设置",
  },
  "quota-exceeded": {
    tone: "warning",
    title: "模型额度已用尽",
    detail: "当前模型账户配额已达上限，请更换密钥或稍后重试。",
    actionLabel: "切换模型配置",
  },
  unavailable: {
    tone: "warning",
    title: "AI 服务暂不可用",
    detail: "离线模式或远端服务维护中，已保留已有本地邮件操作能力。",
    actionLabel: "恢复默认状态",
  },
  "disabled-sensitive": {
    tone: "warning",
    title: "敏感邮件已禁止 AI 读取",
    detail: "垃圾邮件、回收站与疑似钓鱼风险邮件默认不向 AI 发送任何内容。",
    actionLabel: "了解隐私策略",
  },
};

export function AiStatusPanel({
  status,
  onRetry,
}: {
  status: AiRunStatus;
  onRetry: () => void;
}) {
  const { workspace, aiStore } = useApp();

  if (status === "processing") {
    return (
      <div className="ai-status-box">
        <div className="ai-card-head">
          <span className="row" style={{ color: "var(--brand-ai)" }}>
            <Icon name="sparkle" size={14} /> 正在分析当前邮件正文…
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={aiStore.stopGeneration}
          >
            停止生成
          </button>
        </div>
        <div className="text-muted text-xs">
          严格遵循隐私边界：仅使用本封邮件正文，不包含地址簿与附件内容。
        </div>
      </div>
    );
  }

  if (status === "idle") return null;

  const meta = STATUS_META[status];
  return (
    <div className={`ai-status-box ${meta.tone}`}>
      <div className="row-between">
        <strong>{meta.title}</strong>
        <Icon name="alertCircle" size={15} />
      </div>
      <div style={{ lineHeight: 1.5 }}>{meta.detail}</div>
      <div className="row">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            if (status === "invalid-key" || status === "quota-exceeded") {
              workspace.setOverlay({ type: "settings", tab: "ai" });
            } else if (status === "disabled-sensitive") {
              workspace.setOverlay({ type: "settings", tab: "privacy" });
            } else if (status === "unavailable") {
              aiStore.setAiStatus("idle");
            } else {
              onRetry();
            }
          }}
        >
          {meta.actionLabel}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => aiStore.setAiStatus("idle")}
        >
          忽略
        </button>
      </div>
    </div>
  );
}
