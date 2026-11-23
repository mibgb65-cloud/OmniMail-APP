import { useState } from "react";
import { useApp } from "../../../state/AppContext";
import { AsyncActionButton } from "../../common/AsyncActionButton";
import { CustomSelect } from "../../common/CustomSelect";
import { AiProviderFields } from "./AiProviderFields";
import { providerSelectOptions, resolveAiProvider } from "./providerOptions";
import { useAiProviderForm } from "./useAiProviderForm";

export function AiProviderCard() {
  const { workspace } = useApp();
  const [providerId, setProviderId] = useState<string | null>(null);
  const provider = resolveAiProvider(
    providerId ?? workspace.settings.aiProvider,
  );
  return (
    <AiProviderFormCard
      key={provider.value}
      provider={provider}
      onProviderChange={setProviderId}
    />
  );
}

function AiProviderFormCard({
  provider,
  onProviderChange,
}: {
  provider: ReturnType<typeof resolveAiProvider>;
  onProviderChange: (id: string) => void;
}) {
  const { workspace } = useApp();
  const form = useAiProviderForm(
    provider,
    workspace.settings,
    workspace.applySettingsFromBackend,
  );
  const preset = provider.mode === "preset";
  const locked = Boolean(form.busy);
  const badge = preset
    ? form.models?.length
      ? `官方接口 · 已获取 ${form.models.length} 个模型`
      : form.keyMask || form.apiKey.trim()
        ? "官方接口 · 待获取模型"
        : "待配置密钥"
    : provider.mode === "ollama"
      ? "本地服务"
      : "自托管 / 中转网关";
  const footerHint = preset
    ? "无需填写 Base URL；若需代理或自建网关，请切换为「自定义服务」。"
    : provider.mode === "ollama"
      ? "请确认 Ollama 已启动并下载模型。本机服务可以不填密钥。"
      : "支持 OneAPI / vLLM / LM Studio / 企业内网 OpenAI 兼容网关。";
  return (
    <section
      className="ai-provider-settings"
      aria-label="BYOK 多模型端点与加密密钥"
    >
      <div className="ai-provider-heading">
        <strong>BYOK 多模型端点与加密密钥</strong>
        <span
          className={`pill ${form.models?.length ? "pill-success" : "pill-accent"}`}
          role="status"
        >
          {badge}
        </span>
      </div>
      <div className="settings-card ai-provider-surface">
        <div className="ai-provider-row">
          <div className="ai-provider-caption">
            <strong>服务提供方</strong>
            <span className="text-xs text-muted">
              {preset
                ? "选择官方厂商将自动使用官方端点，填写密钥后即可拉取模型列表。"
                : "填写服务端点，可手动设置模型或尝试拉取列表。"}
            </span>
          </div>
          <div className="ai-provider-choice">
            <CustomSelect
              fullWidth
              ariaLabel="AI 服务提供方"
              value={provider.value}
              options={providerSelectOptions}
              disabled={form.busy === "save" || form.busy === "clear"}
              onChange={onProviderChange}
            />
          </div>
        </div>
        <AiProviderFields provider={provider} form={form} />
        {form.feedback && (
          <p
            className={`ai-provider-feedback${form.feedback.error ? " error" : ""}`}
            role={form.feedback.error ? "alert" : "status"}
          >
            {form.feedback.message}
          </p>
        )}
        <div className="ai-provider-footer">
          <span className="text-xs text-muted">{footerHint}</span>
          <div className="ai-provider-actions">
            <AsyncActionButton
              size="sm"
              variant="secondary"
              status={form.busy === "test" ? "loading" : "idle"}
              disabled={locked || !form.canSaveOrTest}
              idleIcon="zap"
              idleLabel="测试模型连通性"
              loadingLabel="测试中…"
              onClick={() => void form.run("test")}
            />
            <AsyncActionButton
              size="sm"
              status={form.busy === "save" ? "loading" : "idle"}
              disabled={locked || !form.canSaveOrTest}
              idleLabel="保存配置"
              loadingLabel="正在加密保存…"
              onClick={() => void form.run("save")}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
