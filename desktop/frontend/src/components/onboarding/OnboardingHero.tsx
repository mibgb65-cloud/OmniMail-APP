import { Icon, type IconName } from "../common/Icon";

const HIGHLIGHTS: Array<{ icon: IconName; title: string; desc: string }> = [
  {
    icon: "inbox",
    title: "统一多邮箱收件箱",
    desc: "同时连接 Gmail、Outlook、QQ、网易 163/126 与标准 IMAP，清晰标记每封邮件来源。",
  },
  {
    icon: "lock",
    title: "原收件账户自动锁定",
    desc: "回复工作或个人邮件时自动锁定原收件账户，彻底避免跨身份错发风险。",
  },
  {
    icon: "sparkle",
    title: "边界透明的 Omni AI 副驾驶",
    desc: "显式触发摘要、待办提取与草稿改写，仅使用当前正文，地址与附件绝不外传。",
  },
];

export function OnboardingHero() {
  return (
    <div>
      <span className="pill pill-accent">OmniMail 0.1 · 桌面工作台</span>
      <h1 className="onboarding-hero-title">
        把所有重要邮箱，
        <br />
        收拢进同一处清爽秩序
      </h1>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.7,
          color: "var(--text-body)",
          margin: "0 0 22px",
        }}
      >
        专为高频处理多账号邮件的创作者与工程团队打造。所有邮件索引与规则均保存在本地设备，
        凭据加密写入系统钥匙串，不留存邮箱网页登录密码。
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {HIGHLIGHTS.map((item) => (
          <div key={item.title} className="onboarding-feature-card">
            <div
              className="btn-icon"
              style={{
                background: "var(--bg-selected)",
                color: "var(--brand-accent)",
                flexShrink: 0,
              }}
            >
              <Icon name={item.icon} size={16} />
            </div>
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  color: "var(--text-ink)",
                }}
              >
                {item.title}
              </div>
              <div
                className="text-xs text-muted"
                style={{ marginTop: 3, lineHeight: 1.55 }}
              >
                {item.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
