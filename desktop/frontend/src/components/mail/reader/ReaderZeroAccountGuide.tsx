import { FadeScroll } from "../../common/scroll-fade/FadeScroll";
import { useApp } from "../../../state/AppContext";
import type { ProviderId } from "../../../types/account";
import { ProviderIcon } from "../../common/ProviderIcon";
import { Icon } from "../../common/Icon";

const QUICK_PROVIDERS: Array<{
  id: ProviderId;
  label: string;
  action: "oauth" | "guide" | "manual";
}> = [
  { id: "gmail", label: "Gmail", action: "oauth" },
  { id: "qq", label: "QQ 邮箱", action: "guide" },
  { id: "netease", label: "网易 163 / 126", action: "guide" },
  { id: "outlook", label: "Outlook", action: "oauth" },
  { id: "icloud", label: "iCloud", action: "guide" },
  { id: "imap", label: "通用 IMAP / SMTP", action: "manual" },
];

export function ReaderZeroAccountGuide() {
  const { workspace } = useApp();
  const profileName = workspace.activeProfile?.name || "个人工作空间";

  const handleQuickChip = (
    provider: ProviderId,
    action: "oauth" | "guide" | "manual",
  ) => {
    if (action === "manual") {
      workspace.setOverlay({ type: "manual-imap" });
      return;
    }
    if (action === "oauth") {
      workspace.setOverlay({
        type: "oauth-flow",
        provider,
        stage: "waiting",
      });
      return;
    }
    workspace.setOverlay({ type: "provider-guide", provider });
  };

  return (
    <FadeScroll className="zero-guide-stage" label="邮箱接入引导">
      <div className="zero-guide-card">
        <span className="zero-guide-pill">
          <span className="zero-guide-pill-dot" aria-hidden="true" />
          <span>本地优先 · 开源无云端账号</span>
        </span>

        <div className="zero-guide-head">
          <h2 className="zero-guide-title">
            连接你的第一个邮箱，开始使用 OmniMail
          </h2>
          <p className="zero-guide-desc">
            邮件正文、附件与凭据全部加密保存在当前「{profileName}
            」，断网亦可随时查阅与检索。
          </p>
        </div>

        <div
          className="zero-guide-grid"
          role="group"
          aria-label="常用邮箱服务商快捷接入"
        >
          {QUICK_PROVIDERS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="zero-guide-chip"
              onClick={() => handleQuickChip(chip.id, chip.action)}
            >
              <ProviderIcon provider={chip.id} size={18} />
              <span className="truncate">{chip.label}</span>
            </button>
          ))}
        </div>

        <div className="zero-guide-actions">
          <button
            type="button"
            className="btn btn-primary zero-guide-primary-btn"
            onClick={() => workspace.setOverlay({ type: "add-account" })}
          >
            <Icon name="plus" size={13} /> 添加邮箱账户
          </button>
          <button
            type="button"
            className="btn btn-secondary zero-guide-secondary-btn"
            onClick={() => workspace.setOverlay({ type: "manual-imap" })}
          >
            手动配置 IMAP / SMTP
          </button>
        </div>

        <p className="zero-guide-footnote">
          凭据经 Windows DPAPI 加密保护 · 随时可在左下角
          <button
            type="button"
            className="zero-guide-inline-link"
            onClick={() =>
              workspace.setOverlay({ type: "profile-manage", mode: "switch" })
            }
          >
            切换或新建本地空间
          </button>
        </p>
      </div>
    </FadeScroll>
  );
}
