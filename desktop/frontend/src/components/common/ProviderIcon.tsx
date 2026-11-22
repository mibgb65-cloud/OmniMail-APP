import gmailPng from "../../assets/providers/gmail.png";
import icloudPng from "../../assets/providers/icloud.png";
import neteasePng from "../../assets/providers/netease.png";
import outlookPng from "../../assets/providers/outlook.png";
import qqPng from "../../assets/providers/qq.png";
import yahooPng from "../../assets/providers/yahoo.png";
import yandexPng from "../../assets/providers/yandex.png";
import type { ProviderId } from "../../types/account";
import { Icon } from "./Icon";

const OFFICIAL_ICONS: Partial<Record<ProviderId, string>> = {
  gmail: gmailPng,
  outlook: outlookPng,
  qq: qqPng,
  netease: neteasePng,
  icloud: icloudPng,
  yahoo: yahooPng,
  yandex: yandexPng,
};

interface ProviderIconProps {
  provider: ProviderId;
  size?: number;
}

/** 严格遵守设计规范：7 家官方邮箱使用设计图嵌入的原始 PNG；其余使用中性矢量图标 */
export function ProviderIcon({ provider, size = 24 }: ProviderIconProps) {
  const src = OFFICIAL_ICONS[provider];
  if (src) {
    return (
      <span
        style={{
          width: size,
          height: size,
          borderRadius: Math.max(5, Math.round(size * 0.25)),
          background: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        <img
          src={src}
          alt={provider}
          width={Math.round(size * 0.72)}
          height={Math.round(size * 0.72)}
          style={{ objectFit: "contain", display: "block" }}
        />
      </span>
    );
  }

  const iconName =
    provider === "linuxdo"
      ? "terminal"
      : provider === "nevermail"
        ? "clock"
        : "server";

  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(5, Math.round(size * 0.25)),
        background: "var(--bg-subtle)",
        border: "1px solid var(--border-default)",
        color: "var(--text-secondary)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon name={iconName} size={Math.round(size * 0.56)} />
    </span>
  );
}
