import { useState } from "react";
import { profileApi } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import type { AppSettings } from "../../types/settings";
import { AiProviderCard } from "./ai/AiProviderCard";
import { SwitchRow } from "./SwitchRow";

export function AiSettingsModeBadge() {
  const {
    workspace: { settings },
  } = useApp();
  const automatic = settings.aiEnabled && settings.aiAutoSummarizeOnOpen;
  return (
    <span className={`pill ${automatic ? "pill-ai" : "pill-neutral"}`}>
      {!settings.aiEnabled
        ? "已停用"
        : automatic
          ? "阅读时自动摘要"
          : "按需手动触发"}
    </span>
  );
}

export function AiSettingsTab() {
  const { workspace, toastStore } = useApp();
  const s = workspace.settings;
  const [saving, setSaving] = useState(false);

  const savePrivacy = async (patch: Partial<AppSettings>) => {
    setSaving(true);
    try {
      // 后端确认保存后再改变提示，避免开关与真正发送范围不一致。
      await profileApi.updateAppSettings(patch);
      workspace.applySettingsFromBackend(patch);
    } catch {
      toastStore.pushToast({
        tone: "warning",
        title: "无法保存 AI 隐私设置，请重试",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>Omni AI 隐私边界与开关</strong>
        <SwitchRow
          heading="启用右侧 Omni AI 助手"
          desc="关闭后不会加载任何摘要与建议，工作台完全作为纯协议邮件客户端运行"
          checked={s.aiEnabled}
          disabled={saving}
          onChange={(v) => void savePrivacy({ aiEnabled: v })}
        />
        <SwitchRow
          heading="打开邮件时自动生成摘要"
          desc="仅在打开尚未摘要的邮件时自动总结（本地缓存，不重复消耗额度；高敏感与验证码邮件自动跳过；回复草稿仍需手动触发）"
          checked={s.aiAutoSummarizeOnOpen}
          disabled={saving || !s.aiEnabled}
          onChange={(v) => void savePrivacy({ aiAutoSummarizeOnOpen: v })}
        />
        <div className="text-xs text-muted">
          仅在 Omni AI
          面板展开时生效。自动摘要会使用已配置的模型，不逐次弹出确认。
        </div>
        <SwitchRow
          heading="每次显式触发前弹出数据范围确认"
          desc="在发送前说明这次会使用正文、可选主题和对话上下文，并等待确认"
          checked={s.aiRequireConfirmEachTime}
          disabled={saving}
          onChange={(v) => void savePrivacy({ aiRequireConfirmEachTime: v })}
        />
        <SwitchRow
          heading="允许附带正在阅读的邮件主题（默认关闭）"
          desc="关闭时仅取邮件正文；开启后同时使用主题。两种模式均不发送邮件附件、文件名或附件内容预览。"
          checked={s.aiIncludeSenderAndAttachments}
          disabled={saving}
          onChange={(v) =>
            void savePrivacy({ aiIncludeSenderAndAttachments: v })
          }
        />
      </div>

      <AiProviderCard key={workspace.activeProfileId} />
    </div>
  );
}
