import { useState, type ReactNode } from "react";
import { INITIAL_SETTINGS } from "../../../data/settingsDefaults";
import type { AppSettings } from "../../../types/settings";
import type { TranslationSettingsPatch } from "../TranslationSettingsTab";
import { TranslationConnectionTest } from "./TranslationConnectionTest";

export function TranslationEngineFields({
  settings,
  saving,
  save,
  onOpenAi,
  children,
}: {
  settings: AppSettings;
  saving: boolean;
  save: (patch: TranslationSettingsPatch) => Promise<void>;
  onOpenAi: () => void;
  children: ReactNode;
}) {
  const [endpoint, setEndpoint] = useState(settings.translationEndpoint);
  const [timeout, setTimeoutSec] = useState(
    String(settings.translationTimeoutSec),
  );
  const usesAI = settings.translationProvider === "ai";
  const dirty =
    endpoint.trim() !== settings.translationEndpoint ||
    timeout !== String(settings.translationTimeoutSec);
  const seconds = Number(timeout);
  const canSave =
    endpoint.trim() &&
    Number.isInteger(seconds) &&
    seconds >= 1 &&
    seconds <= 30;
  const initial = INITIAL_SETTINGS.translationEndpoint;

  return (
    <section className="settings-card" aria-label="翻译引擎与接口配置">
      <div className="row translation-settings-heading">
        <strong>翻译引擎与接口配置</strong>
        {!usesAI && (
          <span className="pill pill-neutral">
            哔哩哔哩免费接口 · 无需 API Key
          </span>
        )}
      </div>
      <label className="settings-row">
        翻译服务提供商
        <select
          className="input"
          disabled={saving}
          value={settings.translationProvider}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "ai" || value === "bilibili")
              void save({ translationProvider: value });
          }}
        >
          <option value="bilibili">哔哩哔哩免费翻译（默认推荐）</option>
          <option value="ai">AI 助手模型（BYOK）</option>
        </select>
      </label>
      {children}
      {usesAI ? (
        <div className="settings-row">
          <span className="text-sm text-muted">
            {settings.aiEnabled
              ? "使用 AI 助手中已配置的模型。"
              : "需先启用并配置 AI 模型。"}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onOpenAi}
          >
            配置模型
          </button>
        </div>
      ) : (
        <form
          className="translation-engine-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (dirty && canSave && !saving)
              void save({
                translationEndpoint: endpoint.trim(),
                translationTimeoutSec: seconds,
              });
          }}
        >
          <div className="row-between">
            <label htmlFor="translation-endpoint">接口端点地址</label>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={
                saving ||
                (endpoint === initial &&
                  settings.translationEndpoint === initial)
              }
              onClick={() => {
                setEndpoint(initial);
                if (settings.translationEndpoint !== initial)
                  void save({ translationEndpoint: initial });
              }}
            >
              恢复默认端点
            </button>
          </div>
          <input
            id="translation-endpoint"
            className="input"
            type="url"
            value={endpoint}
            maxLength={2048}
            required
            disabled={saving}
            onChange={(e) => setEndpoint(e.target.value)}
          />
          <p className="text-xs text-muted translation-setting-note">
            默认地址为预设，实际直连官方接口
            <code>
              https://index-translate.bilibili.com/v1/chat/completions
            </code>
            。 自定义地址须兼容该接口，不回退到其他服务器；建议使用 HTTPS。
          </p>
          <label className="row-between">
            <span>请求超时 / 失败回退</span>
            <span className="row">
              <input
                className="input translation-timeout-input"
                type="number"
                min={1}
                max={30}
                step={1}
                required
                aria-label="请求超时（秒）"
                value={timeout}
                disabled={saving}
                onChange={(e) => setTimeoutSec(e.target.value)}
              />
              <span className="text-xs text-muted">秒 · 自动重试一次</span>
            </span>
          </label>
          <button
            type="submit"
            className="btn btn-primary btn-sm translation-engine-save"
            disabled={!dirty || !canSave || saving}
          >
            保存接口配置
          </button>
        </form>
      )}
      <TranslationConnectionTest
        key={JSON.stringify([
          settings.translationEnabled,
          settings.aiEnabled,
          settings.aiProvider,
          settings.aiModel,
          settings.aiBaseUrl,
        ])}
        disabled={
          saving ||
          !settings.translationEnabled ||
          (usesAI ? !settings.aiEnabled : dirty)
        }
      />
    </section>
  );
}
