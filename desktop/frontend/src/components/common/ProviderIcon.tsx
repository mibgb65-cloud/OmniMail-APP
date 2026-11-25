import gmailPng from "../../assets/providers/gmail.png";
import icloudPng from "../../assets/providers/icloud.png";
import linuxdoPng from "../../assets/providers/linuxdo.png";
import museSvg from "../../assets/providers/muse.svg";
import naverPng from "../../assets/providers/naver.png";
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
  linuxdo: linuxdoPng,
  nevermail: naverPng,
  muse: museSvg,
};

interface ProviderIconProps {
  provider: ProviderId;
  size?: number;
  bare?: boolean;
}

/** 9 家内置邮箱服务商使用官方 PNG 图标；通用 IMAP 使用中性服务器矢量图标 */
export function ProviderIcon({
  provider,
  size = 24,
  bare = false,
}: ProviderIconProps) {
  const src = OFFICIAL_ICONS[provider];
  if (src) {
    if (bare) {
      return (
        <img
          src={src}
          alt={provider}
          width={size}
          height={size}
          style={{ objectFit: "contain", display: "block", flexShrink: 0 }}
        />
      );
    }
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

  if (bare) {
    return <Icon name={iconName} size={size} />;
  }

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
