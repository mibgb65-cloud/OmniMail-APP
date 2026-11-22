import { useApp } from "../../state/AppContext";
import type { AiRunStatus } from "../../types/workspace";
import { Icon } from "../common/Icon";
import { SwitchRow } from "./SwitchRow";

const STATUS_CHIPS: Array<{ id: AiRunStatus; label: string }> = [
  { id: "idle", label: "正常就绪" },
  { id: "processing", label: "生成中" },
  { id: "error", label: "请求失败" },
  { id: "invalid-key", label: "密钥无效" },
  { id: "quota-exceeded", label: "额度不足" },
  { id: "unavailable", label: "服务不可用" },
];

export function AiSettingsTab() {
  const { workspace, aiStore, toastStore } = useApp();
  const s = workspace.settings;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>Omni AI 隐私边界与开关</strong>
        <SwitchRow
          title="启用右侧 Omni AI 助手"
          desc="关闭后不会自动加载任何摘要与建议，工作台完全作为纯邮件客户端运行"
          checked={s.aiEnabled}
          onChange={(v) => workspace.updateSettings({ aiEnabled: v })}
        />
        <SwitchRow
          title="每次显式触发前弹出数据范围确认"
          desc="清晰展示「仅发送当前邮件正文 · 不外传地址与附件」并等待确认"
          checked={s.aiRequireConfirmEachTime}
          onChange={(v) =>
            workspace.updateSettings({ aiRequireConfirmEachTime: v })
          }
        />
        <SwitchRow
          title="允许附带收发件人地址与附件摘要（默认关闭）"
          desc="出于最小化披露原则建议保持关闭；垃圾邮件与回收站始终禁用 AI 读取"
          checked={s.aiIncludeSenderAndAttachments}
          onChange={(v) =>
            workspace.updateSettings({ aiIncludeSenderAndAttachments: v })
          }
        />
      </div>

      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>模型端点配置</strong>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div>
            <label className="text-xs text-muted">服务提供方</label>
            <input
              className="input"
              style={{ marginTop: 4 }}
              value={s.aiProvider}
              onChange={(e) =>
                workspace.updateSettings({ aiProvider: e.target.value })
              }
            />
          </div>
          <div>
            <label className="text-xs text-muted">模型名称</label>
            <input
              className="input"
              style={{ marginTop: 4 }}
              value={s.aiModel}
              onChange={(e) =>
                workspace.updateSettings({ aiModel: e.target.value })
              }
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted">API 密钥（脱敏展示）</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={s.aiApiKeyMasked}
            onChange={(e) =>
              workspace.updateSettings({ aiApiKeyMasked: e.target.value })
            }
          />
        </div>
      </div>

      <div className="settings-card">
        <div className="row" style={{ fontSize: 13, fontWeight: 700 }}>
          <Icon name="sparkle" size={14} /> AI 异常状态预览（界面验收快捷切换）
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          {STATUS_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`btn btn-sm ${aiStore.aiStatus === chip.id ? "btn-primary" : "btn-secondary"}`}
              onClick={() => {
                aiStore.setAiOpen(true);
                aiStore.setAiStatus(chip.id);
                toastStore.pushToast({
                  tone: "info",
                  title: `AI 面板状态已切换：${chip.label}`,
                });
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
