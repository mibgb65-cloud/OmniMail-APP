import type { CSSProperties } from "react";
import gmailPng from "../../assets/providers/gmail.png";
import icloudPng from "../../assets/providers/icloud.png";
import linuxdoPng from "../../assets/providers/linuxdo.png";
import museSvg from "../../assets/providers/muse.svg";
import naverPng from "../../assets/providers/naver.png";
import neteasePng from "../../assets/providers/netease.png";
import outlookPng from "../../assets/providers/outlook.png";
import qqPng from "../../assets/providers/qq.png";
import workbuddyPng from "../../assets/providers/workbuddy.png";
import yahooPng from "../../assets/providers/yahoo.png";
import yandexPng from "../../assets/providers/yandex.png";
import type { ProviderId } from "../../types/account";
import {
  ENTERPRISE_BADGE_THEMES,
  renderEnterpriseGlyph,
} from "./EnterpriseProviderGlyph";
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
  workbuddy: workbuddyPng,
};

interface ProviderIconProps {
  provider: ProviderId;
  size?: number;
  bare?: boolean;
}

/** 内置服务商使用官方 PNG 或企业邮箱品牌矢量徽标；通用 IMAP 使用中性服务器矢量图标 */
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

  const entTheme = ENTERPRISE_BADGE_THEMES[provider];
  if (entTheme) {
    if (bare) {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {renderEnterpriseGlyph(provider, size)}
        </span>
      );
    }
    const entStyle = {
      width: size,
      height: size,
      borderRadius: Math.max(5, Math.round(size * 0.25)),
      "--ent-bg-light": entTheme.lightBg,
      "--ent-bd-light": entTheme.lightBd,
      "--ent-bg-dark": entTheme.darkBg,
      "--ent-bd-dark": entTheme.darkBd,
    } as CSSProperties;
    return (
      <span className="provider-ent-badge" style={entStyle}>
        {renderEnterpriseGlyph(provider, Math.round(size * 0.72))}
      </span>
    );
  }

  if (bare) {
    return <Icon name="server" size={size} />;
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
      <Icon name="server" size={Math.round(size * 0.56)} />
    </span>
  );
}
