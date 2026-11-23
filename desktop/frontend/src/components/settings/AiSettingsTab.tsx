import { useApp } from "../../state/AppContext";
import { AiProviderCard, type AiProviderOption } from "./AiProviderCard";
import { SwitchRow } from "./SwitchRow";

const AI_PROVIDERS: AiProviderOption[] = [
  { value: "openai", label: "OpenAI", sublabel: "https://api.openai.com/v1" },
  {
    value: "deepseek",
    label: "DeepSeek",
    sublabel: "https://api.deepseek.com/v1",
  },
  {
    value: "claude",
    label: "Anthropic Claude",
    sublabel: "https://api.anthropic.com/v1",
  },
  {
    value: "gemini",
    label: "Google Gemini",
    sublabel: "generativelanguage.googleapis.com",
  },
  {
    value: "ollama",
    label: "Ollama（完全本地离线）",
    sublabel: "http://127.0.0.1:11434/v1",
  },
  {
    value: "custom",
    label: "自定义 OpenAI 兼容网关",
    sublabel: "LM Studio / vLLM / OneAPI",
  },
];

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

      <AiProviderCard options={AI_PROVIDERS} />
    </div>
  );
}
