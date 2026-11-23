import { useState } from "react";
import { aiApi, parseBackendError } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import {
  AsyncActionButton,
  type AsyncActionStatus,
} from "../common/AsyncActionButton";
import { CustomSelect } from "../common/CustomSelect";
import { PasswordInput } from "../common/PasswordInput";

export interface AiProviderOption {
  value: string;
  label: string;
  sublabel: string;
}

export function AiProviderCard({ options }: { options: AiProviderOption[] }) {
  const { workspace, toastStore } = useApp();
  const s = workspace.settings;
  const [provider, setProvider] = useState(s.aiProvider || "openai");
  const [model, setModel] = useState(s.aiModel || "gpt-4o-mini");
  const [baseUrl, setBaseUrl] = useState(s.aiBaseUrl ?? "");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<AsyncActionStatus>("idle");
  const [testStatus, setTestStatus] = useState<AsyncActionStatus>("idle");

  const persistProviderSilent = async () => {
    const saved = await aiApi.saveProviderConfig({
      provider,
      model: model.trim(),
      baseUrl: baseUrl.trim(),
      apiKey: apiKeyInput.trim(),
    });
    if (saved) workspace.applySettingsFromBackend(saved);
    else {
      workspace.updateSettings({
        aiProvider: provider,
        aiModel: model,
        aiBaseUrl: baseUrl,
      });
    }
    setApiKeyInput("");
  };

  const handleSaveProvider = async () => {
    setSaveStatus("loading");
    const hadKey = Boolean(apiKeyInput.trim());
    try {
      await persistProviderSilent();
      setSaveStatus("success");
      toastStore.pushToast({
        tone: "success",
        title: "AI 模型配置已保存",
        detail: hadKey ? "密钥已使用 DPAPI 加密写入本地凭据盒" : undefined,
      });
    } catch (err) {
      setSaveStatus("error");
      toastStore.pushToast({
        tone: "danger",
        title: "保存 AI 配置失败",
        detail: parseBackendError(err).message,
      });
    }
  };

  const handleTest = async () => {
    setTestStatus("loading");
    try {
      if (apiKeyInput.trim()) await persistProviderSilent();
      const res = await aiApi.testConnection();
      setTestStatus(res.ok ? "success" : "error");
      toastStore.pushToast({
        tone: res.ok ? "success" : "warning",
        title: res.ok ? "模型服务连通正常" : "模型连接未通过",
        detail: res.message,
      });
    } catch (err) {
      setTestStatus("error");
      toastStore.pushToast({
        tone: "danger",
        title: "测试连接失败",
        detail: parseBackendError(err).message,
      });
    }
  };

  const anyBusy = saveStatus === "loading" || testStatus === "loading";

  return (
    <div className="settings-card">
      <strong style={{ fontSize: 14 }}>BYOK 多模型端点与加密密钥</strong>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">服务提供方</label>
          <CustomSelect
            fullWidth
            style={{ marginTop: 4 }}
            value={provider}
            ariaLabel="AI 服务提供方"
            options={options}
            onChange={(val) => {
              setProvider(val);
              if (val === "ollama" && !baseUrl) {
                setBaseUrl("http://127.0.0.1:11434/v1");
              }
            }}
          />
        </div>
        <div>
          <label className="text-xs text-muted">模型名称</label>
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="如 gpt-4o-mini / qwen2.5:7b"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted">
          自定义 Base URL（留空使用官方默认地址）
        </label>
        <input
          className="input"
          style={{ marginTop: 4 }}
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.openai.com/v1 或 http://127.0.0.1:11434/v1"
        />
      </div>

      <div>
        <label className="text-xs text-muted">
          API 密钥（DPAPI 加密存储 · 当前：{s.aiApiKeyMasked || "未设置"}）
        </label>
        <PasswordInput
          style={{ marginTop: 4 }}
          value={apiKeyInput}
          onChange={setApiKeyInput}
          placeholder={
            provider === "ollama"
              ? "本地 Ollama 无需填写 API Key"
              : "输入新 API Key 以覆盖保存（留空保留现有密钥）"
          }
          ariaLabel="AI API 密钥"
        />
      </div>

      <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
        {s.aiApiKeyMasked && (
          <button
            type="button"
            disabled={anyBusy}
            className="btn btn-ghost btn-sm"
            style={{ color: "var(--status-danger)" }}
            onClick={() => {
              void aiApi.clearApiKey(provider).then((next) => {
                if (next) workspace.applySettingsFromBackend(next);
                toastStore.pushToast({
                  tone: "info",
                  title: "已清除本地加密密钥",
                });
              });
            }}
          >
            清空密钥
          </button>
        )}
        <AsyncActionButton
          size="sm"
          variant="secondary"
          status={testStatus}
          disabled={saveStatus === "loading"}
          idleIcon="zap"
          idleLabel="测试模型连通性"
          loadingLabel="正在探测接口…"
          successLabel="连通正常"
          errorLabel="探测未过 · 重试"
          successHoldMs={1000}
          onSuccessHoldEnd={() => setTestStatus("idle")}
          onClick={() => void handleTest()}
        />
        <AsyncActionButton
          size="sm"
          variant="primary"
          status={saveStatus}
          disabled={testStatus === "loading"}
          idleLabel="保存配置"
          loadingLabel="正在加密保存…"
          successLabel="配置已保存"
          errorLabel="保存失败 · 重试"
          successHoldMs={900}
          onSuccessHoldEnd={() => setSaveStatus("idle")}
          onClick={() => void handleSaveProvider()}
        />
      </div>
    </div>
  );
}
