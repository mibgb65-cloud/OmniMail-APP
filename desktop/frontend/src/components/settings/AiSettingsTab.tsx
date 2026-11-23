import { useApp } from "../../state/AppContext";
import { AiProviderCard } from "./ai/AiProviderCard";
import { SwitchRow } from "./SwitchRow";

export function AiSettingsTab() {
  const { workspace } = useApp();
  const s = workspace.settings;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>Omni AI 隐私边界与开关</strong>
        <SwitchRow
          heading="启用右侧 Omni AI 助手"
          desc="关闭后不会加载任何摘要与建议，工作台完全作为纯协议邮件客户端运行"
          checked={s.aiEnabled}
          onChange={(v) => workspace.updateSettings({ aiEnabled: v })}
        />
        <SwitchRow
          heading="每次显式触发前弹出数据范围确认"
          desc="清晰展示「仅发送当前邮件正文 · 不外传地址与附件」并等待确认"
          checked={s.aiRequireConfirmEachTime}
          onChange={(v) =>
            workspace.updateSettings({ aiRequireConfirmEachTime: v })
          }
        />
        <SwitchRow
          heading="允许附带主题与纯文本附件摘要（默认关闭）"
          desc="默认严格仅发纯文本正文；开启后仍永不上传二进制附件与敏感邮件"
          checked={s.aiIncludeSenderAndAttachments}
          onChange={(v) =>
            workspace.updateSettings({ aiIncludeSenderAndAttachments: v })
          }
        />
      </div>

      <AiProviderCard key={workspace.activeProfileId} />
    </div>
  );
}
