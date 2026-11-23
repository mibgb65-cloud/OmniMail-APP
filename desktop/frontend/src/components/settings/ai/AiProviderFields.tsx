import { AsyncActionButton } from "../../common/AsyncActionButton";
import { CustomSelect } from "../../common/CustomSelect";
import { PasswordInput } from "../../common/PasswordInput";
import type { AiProviderOption } from "./providerOptions";
import type { AiProviderForm } from "./useAiProviderForm";

function ListModelsButton({
  form,
  preset,
}: {
  form: AiProviderForm;
  preset: boolean;
}) {
  return (
    <AsyncActionButton
      variant={preset ? "primary" : "secondary"}
      status={form.busy === "fetch" ? "loading" : "idle"}
      disabled={Boolean(form.busy) || !form.canFetch}
      idleIcon="refresh"
      idleLabel={preset ? "获取模型列表" : "尝试拉取模型"}
      loadingLabel="获取中…"
      onClick={() => void form.run("fetch")}
    />
  );
}

export function AiProviderFields({
  provider,
  form,
}: {
  provider: AiProviderOption;
  form: AiProviderForm;
}) {
  const preset = provider.mode === "preset";
  const locked = Boolean(form.busy);
  const modelOptions = (form.models ?? []).map((id) => ({
    value: id,
    label: id,
  }));
  const modelPlaceholder = form.models ? "未发现可用模型" : "请先获取模型列表";
  const modelLabel = preset ? "选择模型" : "模型名称";
  return (
    <>
      {!preset && (
        <label className="ai-provider-field">
          <span>
            自定义 Base URL{provider.mode === "custom" ? "（必填）" : ""}
          </span>
          <input
            className="input ai-provider-mono"
            value={form.baseUrl}
            maxLength={2048}
            disabled={locked}
            placeholder={
              provider.defaultBaseUrl || "https://your-gateway.example.com/v1"
            }
            onChange={(e) => form.changeBase(e.target.value)}
          />
          <span className="text-xs text-muted">
            非本机地址使用密钥时须用 HTTPS。
          </span>
        </label>
      )}
      <div className="ai-provider-field">
        <div className="ai-provider-key-label">
          <span>
            API 密钥（{!preset && "选填 · "}DPAPI 加密存储 · 当前：
            {form.keyMask || "未设置"}）
          </span>
          {preset && (
            <span className="text-xs text-muted ai-provider-mono">
              官方端点：{provider.defaultBaseUrl.replace(/^https:\/\//, "")}
            </span>
          )}
        </div>
        <div className="ai-provider-input-row">
          <PasswordInput
            value={form.apiKey}
            onChange={form.changeKey}
            disabled={locked}
            maxLength={4096}
            ariaLabel="AI API 密钥"
            placeholder={
              preset
                ? `输入 ${provider.label} API Key（留空使用已保存密钥）`
                : "选填 · 本地免密网关可留空"
            }
          />
          {preset && <ListModelsButton form={form} preset />}
        </div>
        {form.keyMask && (
          <button
            type="button"
            className="btn btn-ghost btn-sm ai-provider-clear"
            disabled={locked}
            onClick={() => void form.run("clear")}
          >
            清除已保存密钥
          </button>
        )}
      </div>
      {preset ? (
        <div className="ai-provider-row">
          <div className="ai-provider-caption">
            <strong>{modelLabel}</strong>
            <span className="text-xs text-muted">
              {form.models?.length
                ? `已通过 ${provider.label} API Key 拉取 ${form.models.length} 个模型`
                : form.models
                  ? "官方接口没有返回可用模型，请检查账号权限"
                  : form.apiKey.trim() || form.keyMask
                    ? "密钥已就绪，点击「获取模型列表」后选择"
                    : "请先填写 API 密钥并点击「获取模型列表」"}
            </span>
          </div>
          <div className="ai-provider-choice">
            <CustomSelect
              value={form.model}
              fullWidth
              mono
              ariaLabel={modelLabel}
              searchLabel="搜索模型"
              options={
                modelOptions.length
                  ? modelOptions
                  : [
                      {
                        value: form.model,
                        label: form.model || modelPlaceholder,
                      },
                    ]
              }
              disabled={locked || modelOptions.length === 0}
              onChange={form.changeModel}
            />
          </div>
        </div>
      ) : (
        <div className="ai-provider-field">
          <label htmlFor="ai-manual-model">{modelLabel}（可手动填写）</label>
          <div className="ai-provider-input-row">
            <input
              id="ai-manual-model"
              className="input ai-provider-mono"
              value={form.model}
              maxLength={256}
              disabled={locked}
              placeholder="如 qwen2.5:7b"
              onChange={(e) => form.changeModel(e.target.value)}
            />
            <ListModelsButton form={form} preset={false} />
          </div>
          {modelOptions.length > 0 && (
            <CustomSelect
              value={form.model}
              fullWidth
              mono
              disabled={locked}
              ariaLabel="从拉取结果填入模型"
              searchLabel="搜索模型"
              options={
                modelOptions.some((option) => option.value === form.model)
                  ? modelOptions
                  : [
                      { value: form.model, label: "从拉取结果填入模型" },
                      ...modelOptions,
                    ]
              }
              onChange={form.changeModel}
            />
          )}
          {form.models?.length === 0 && (
            <span className="text-xs text-muted">
              没有发现模型，可以手动填写。
            </span>
          )}
        </div>
      )}
      {form.fetchError && (
        <p className="ai-provider-feedback error" role="alert">
          {form.fetchError}
        </p>
      )}
    </>
  );
}
