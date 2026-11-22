import { useState } from "react";
import { useApp } from "../../state/AppContext";
import { BrandLogo } from "../common/BrandLogo";
import { Icon } from "../common/Icon";
import {
  WindowControls,
  handleDragRegionDoubleClick,
} from "../shell/WindowControls";
import { OnboardingHero } from "./OnboardingHero";

export function OnboardingScreen() {
  const { workspace } = useApp();
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const canStart = agreeTerms && agreePrivacy;

  return (
    <div className="onboarding-page">
      <div
        className="row-between window-drag-region"
        onDoubleClick={handleDragRegionDoubleClick}
      >
        <div className="row" style={{ gap: 10 }}>
          <BrandLogo size={32} />
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: "var(--text-ink)",
              }}
            >
              OmniMail
            </div>
            <div className="text-xs text-muted">
              本地优先的多邮箱桌面工作空间
            </div>
          </div>
        </div>
        <div className="row">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={workspace.toggleTheme}
          >
            <Icon
              name={workspace.settings.theme === "light" ? "moon" : "sun"}
              size={14}
            />
            {workspace.settings.theme === "light" ? "深色模式" : "浅色模式"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => workspace.setScreen("mail")}
          >
            先进入演示工作台
          </button>
          <WindowControls />
        </div>
      </div>

      <div className="onboarding-grid">
        <OnboardingHero />

        <div className="onboarding-card">
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                color: "var(--text-ink)",
              }}
            >
              开始配置你的首个邮箱
            </h2>
            <p
              className="text-muted"
              style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.6 }}
            >
              添加邮箱前请阅读并同意以下基础条款。同意基础条款不会自动开启 Omni
              AI， AI 能力可在工作台内单独开关并按次确认。
            </p>
          </div>

          <div className="settings-card">
            <label className="row" style={{ cursor: "pointer", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
              />
              <span>
                我已阅读并同意{" "}
                <button
                  type="button"
                  style={{ color: "var(--brand-accent)", fontWeight: 600 }}
                  onClick={() =>
                    workspace.setOverlay({ type: "legal-doc", doc: "terms" })
                  }
                >
                  《用户协议》
                </button>
              </span>
            </label>
            <label className="row" style={{ cursor: "pointer", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
              />
              <span>
                我已阅读并同意{" "}
                <button
                  type="button"
                  style={{ color: "var(--brand-accent)", fontWeight: 600 }}
                  onClick={() =>
                    workspace.setOverlay({ type: "legal-doc", doc: "privacy" })
                  }
                >
                  《隐私政策》
                </button>
              </span>
            </label>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ height: 42, fontSize: 14 }}
            disabled={!canStart}
            onClick={() => workspace.setOverlay({ type: "add-account" })}
          >
            <Icon name="plus" size={16} />
            添加首个邮箱
          </button>

          {!canStart && (
            <div className="text-xs text-muted" style={{ textAlign: "center" }}>
              请先勾选同意《用户协议》和《隐私政策》以启用邮箱接入入口
            </div>
          )}

          <div
            className="row-between"
            style={{
              paddingTop: 8,
              borderTop: "1px solid var(--border-default)",
            }}
          >
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => workspace.setOverlay({ type: "manual-imap" })}
              disabled={!canStart}
            >
              直接使用手动 IMAP / SMTP
            </button>
            <span className="text-xs text-muted">
              版本 0.1.0 · 本地加密存储
            </span>
          </div>
        </div>
      </div>

      <div className="text-xs text-muted" style={{ textAlign: "center" }}>
        支持浏览器 OAuth、客户端授权码与标准 IMAP/SMTP ·
        可随时在设置中移除账户或清理本地缓存
      </div>
    </div>
  );
}
