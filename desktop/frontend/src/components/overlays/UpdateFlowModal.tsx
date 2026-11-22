import { useApp } from "../../state/AppContext";
import type { UpdateStage } from "../../types/ui";
import { ModalShell } from "../common/ModalShell";

const UPDATE_META: Record<
  UpdateStage,
  {
    title: string;
    badge: string;
    tone: string;
    desc: string;
    progress?: number;
  }
> = {
  checking: {
    title: "正在检查 OmniMail 新版本…",
    badge: "检查中",
    tone: "pill-accent",
    desc: "正在连接签名校验源获取最新桌面端版本清单。",
  },
  available: {
    title: "发现新版本 OmniMail 0.2.0",
    badge: "可更新",
    tone: "pill-accent",
    desc: "包含增量同步提速、会议邀请冲突提醒优化以及暗色模式细节微调（安装包 24.6 MB）。",
  },
  downloading: {
    title: "正在后台下载更新包并校验数字签名…",
    badge: "下载中 64%",
    tone: "pill-accent",
    desc: "下载期间你可以继续正常阅读与回复邮件，不会中断当前草稿。",
    progress: 64,
  },
  failed: {
    title: "更新下载失败（网络超时）",
    badge: "下载失败",
    tone: "pill-danger",
    desc: "未能完整拉取校验签名包。请检查代理或网络状态后重试，当前 0.1.0 版本不受影响。",
  },
  ready: {
    title: "OmniMail 0.2.0 已准备就绪",
    badge: "就绪",
    tone: "pill-success",
    desc: "安装包完整性校验通过。点击「立即重启并更新」后将自动恢复已打开的草稿与当前视图。",
    progress: 100,
  },
};

const UPDATE_STAGES: Array<{ id: UpdateStage; label: string }> = [
  { id: "checking", label: "检查中" },
  { id: "available", label: "发现新版" },
  { id: "downloading", label: "下载中" },
  { id: "failed", label: "下载失败" },
  { id: "ready", label: "重启就绪" },
];

export function UpdateFlowModal({ stage }: { stage: UpdateStage }) {
  const { workspace, toastStore } = useApp();
  const meta = UPDATE_META[stage];

  return (
    <ModalShell
      title="软件更新"
      subtitle="当前版本：0.1.0 · 自动校验数字签名"
      maxWidth={520}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
            {UPDATE_STAGES.map((st) => (
              <button
                key={st.id}
                type="button"
                className={`btn btn-sm ${stage === st.id ? "btn-primary" : "btn-ghost"}`}
                onClick={() =>
                  workspace.setOverlay({ type: "update-flow", stage: st.id })
                }
              >
                {st.label}
              </button>
            ))}
          </div>
          {stage === "ready" ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                workspace.setOverlay({ type: "none" });
                toastStore.pushToast({
                  tone: "success",
                  title: "已预约重启安装 OmniMail 0.2.0",
                  detail: "当前界面为前端演示态，未执行真实进程重启",
                });
              }}
            >
              立即重启更新
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                workspace.setOverlay({
                  type: "update-flow",
                  stage:
                    stage === "checking"
                      ? "available"
                      : stage === "available"
                        ? "downloading"
                        : stage === "downloading"
                          ? "ready"
                          : "downloading",
                })
              }
            >
              {stage === "failed" ? "重试下载" : "下一步"}
            </button>
          )}
        </>
      }
    >
      <div className="settings-card">
        <div className="row-between">
          <strong>{meta.title}</strong>
          <span className={`pill ${meta.tone}`}>{meta.badge}</span>
        </div>
        {meta.progress !== undefined && (
          <div className="storage-bar">
            <div
              style={{
                width: `${meta.progress}%`,
                background: "var(--brand-accent)",
              }}
            />
          </div>
        )}
        <div className="text-xs text-muted" style={{ lineHeight: 1.65 }}>
          {meta.desc}
        </div>
      </div>
    </ModalShell>
  );
}
