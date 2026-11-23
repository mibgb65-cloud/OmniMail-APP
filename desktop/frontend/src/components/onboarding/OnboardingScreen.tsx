import { useState } from "react";
import { useApp } from "../../state/AppContext";
import { BrandLogo } from "../common/BrandLogo";
import { Checkbox } from "../common/Checkbox";
import { Icon } from "../common/Icon";
import {
  WindowControls,
  handleDragRegionDoubleClick,
} from "../shell/WindowControls";
import { OnboardingHero } from "./OnboardingHero";
import { OnboardingInitCard } from "./OnboardingInitCard";

export function OnboardingScreen() {
  const { workspace, desktopBridge, toastStore } = useApp();
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [customDir, setCustomDir] = useState<string | null>(null);

  const effectiveDataDir = customDir ?? desktopBridge.storage.dataDir;
  const canStart = agreeTerms && agreePrivacy;

  const commitAndRun = async (nextAction: () => void) => {
    try {
      await desktopBridge.completeInitialSetup(effectiveDataDir);
      nextAction();
    } catch (err) {
      toastStore.pushToast({
        tone: "danger",
        title: "保存初始化数据目录失败",
        detail: err instanceof Error ? err.message : "请检查数据目录权限",
      });
    }
  };

  return (
    <div className="onboarding-page">
      <div
        className="row-between window-drag-region"
        onDoubleClick={handleDragRegionDoubleClick}
      >
        <div className="row" style={{ gap: 10 }}>
          <BrandLogo size={32} showWordmark={false} />
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
            onClick={() => void commitAndRun(() => workspace.setScreen("mail"))}
          >
            保存偏好并进入工作台
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
                fontSize: 21,
                fontWeight: 800,
                color: "var(--text-ink)",
              }}
            >
              初始化偏好与首个邮箱接入
            </h2>
            <p
              className="text-muted"
              style={{ margin: "4px 0 0", fontSize: 12.5, lineHeight: 1.55 }}
            >
              确认本地数据存储位置与常用偏好。同意基础条款不会自动开启 Omni AI，
              AI 能力可在工作台内单独开关并按次确认。
            </p>
          </div>

          <OnboardingInitCard
            dataDir={effectiveDataDir}
            onChangeDataDir={setCustomDir}
          />

          <div
            className="settings-card"
            style={{ gap: 8, padding: "10px 14px" }}
          >
            <Checkbox
              checked={agreeTerms}
              onChange={setAgreeTerms}
              ariaLabel="同意用户协议"
            >
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
            </Checkbox>
            <Checkbox
              checked={agreePrivacy}
              onChange={setAgreePrivacy}
              ariaLabel="同意隐私政策"
            >
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
            </Checkbox>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ height: 40, fontSize: 14 }}
            disabled={!canStart}
            onClick={() =>
              void commitAndRun(() =>
                workspace.setOverlay({ type: "add-account" }),
              )
            }
          >
            <Icon name="plus" size={16} />
            添加首个邮箱
          </button>

          <div
            className="row-between"
            style={{
              paddingTop: 6,
              borderTop: "1px solid var(--border-default)",
            }}
          >
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                void commitAndRun(() =>
                  workspace.setOverlay({ type: "manual-imap" }),
                )
              }
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
        可随时在设置中迁移数据目录或清理缓存
      </div>
    </div>
  );
}
