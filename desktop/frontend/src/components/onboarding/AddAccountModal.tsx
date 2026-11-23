import { useEffect, useState } from "react";
import { PROVIDER_CATALOG } from "../../data/providers";
import { accountApi } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import type { ProviderCatalogItem } from "../../types/account";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";
import { ProviderIcon } from "../common/ProviderIcon";

export function AddAccountModal() {
  const { workspace } = useApp();
  const [presets, setPresets] =
    useState<ProviderCatalogItem[]>(PROVIDER_CATALOG);

  useEffect(() => {
    let mounted = true;
    void accountApi
      .listProviderPresets()
      .then((list) => {
        if (mounted && list.length > 0) setPresets(list);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ModalShell
      heading="添加邮箱账户"
      subtitle="内置 10 家服务商预设 · 凭据经当前 Windows 用户 DPAPI 加密写入独立空间"
      maxWidth={680}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => workspace.setOverlay({ type: "manual-imap" })}
          >
            <Icon name="server" size={14} /> 其他邮箱 · 手动 IMAP / SMTP
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => workspace.setOverlay({ type: "none" })}
          >
            关闭
          </button>
        </>
      }
    >
      <div className="provider-grid">
        {presets.map((item) => (
          <button
            key={item.id}
            type="button"
            className="provider-card"
            onClick={() => {
              if (item.authMode === "oauth") {
                workspace.setOverlay({
                  type: "oauth-flow",
                  provider: item.id,
                  stage: "waiting",
                });
              } else {
                workspace.setOverlay({
                  type: "provider-guide",
                  provider: item.id,
                });
              }
            }}
          >
            <div className="row" style={{ gap: 11, minWidth: 0 }}>
              <ProviderIcon provider={item.id} size={32} />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: "var(--text-ink)",
                  }}
                >
                  {item.name}
                </div>
                <div className="text-xs text-muted truncate">
                  {item.subtitle}
                </div>
              </div>
            </div>
            <span
              className={`pill ${
                item.badgeTone === "blue"
                  ? "pill-accent"
                  : item.badgeTone === "violet"
                    ? "pill-ai"
                    : item.badgeTone === "amber"
                      ? "pill-warning"
                      : "pill-neutral"
              }`}
              style={{ flexShrink: 0 }}
            >
              {item.badgeText}
            </span>
          </button>
        ))}
      </div>

      <div className="settings-card">
        <div
          className="row"
          style={{ fontSize: 13, fontWeight: 700, color: "var(--text-ink)" }}
        >
          <Icon name="info" size={15} />
          <span>邮箱预设与协议兼容说明</span>
        </div>
        <div className="text-xs text-muted" style={{ lineHeight: 1.65 }}>
          • <strong>Gmail</strong> 同时支持本地 PKCE OAuth 2.0 与 16
          位应用专用密码（自动去空格）。
          <br />• <strong>网易邮箱（163 / 126 / yeah）</strong>{" "}
          自动识别后缀并发送 RFC2971 安全 ID；<strong>Naver Mail</strong>{" "}
          已预置韩国 @naver.com 官方端口。
          <br />• 所有令牌与授权码仅加密保存在本空间 secrets.vault
          中，永不明文落盘或上传云端。
        </div>
      </div>
    </ModalShell>
  );
}
