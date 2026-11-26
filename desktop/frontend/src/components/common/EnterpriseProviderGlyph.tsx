import type { ProviderId } from "../../types/account";

export interface EnterpriseBadgePalette {
  lightBg: string;
  lightBd: string;
  darkBg: string;
  darkBd: string;
}

export const ENTERPRISE_BADGE_THEMES: Partial<
  Record<ProviderId, EnterpriseBadgePalette>
> = {
  tencent_exmail: {
    lightBg: "#eff6ff",
    lightBd: "#bfdbfe",
    darkBg: "#172554",
    darkBd: "#2563eb",
  },
  aliyun_exmail: {
    lightBg: "#fff7ed",
    lightBd: "#fed7aa",
    darkBg: "#431407",
    darkBd: "#c2410c",
  },
  netease_exmail: {
    lightBg: "#fef2f2",
    lightBd: "#fecaca",
    darkBg: "#450a0a",
    darkBd: "#dc2626",
  },
  feishu: {
    lightBg: "#ecfdf5",
    lightBd: "#a7f3d0",
    darkBg: "#064e3b",
    darkBd: "#10b981",
  },
  mail263: {
    lightBg: "#eff6ff",
    lightBd: "#bfdbfe",
    darkBg: "#1e3a8a",
    darkBd: "#3b82f6",
  },
  zoho_exmail: {
    lightBg: "#fef2f2",
    lightBd: "#fecdd3",
    darkBg: "#4c0519",
    darkBd: "#e11d48",
  },
};

export function renderEnterpriseGlyph(provider: ProviderId, size: number) {
  switch (provider) {
    case "tencent_exmail":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5" width="18" height="14" rx="3.2" fill="#2563EB" />
          <path
            d="M5.5 7.5L12 12.6L18.5 7.5"
            stroke="#FFFFFF"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "aliyun_exmail":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect
            x="3.5"
            y="6.5"
            width="17"
            height="11"
            rx="5.5"
            stroke="#FF6A00"
            strokeWidth="2.8"
          />
          <line
            x1="8.5"
            y1="12"
            x2="15.5"
            y2="12"
            stroke="#FF6A00"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case "netease_exmail":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <text
            x="12"
            y="16.8"
            textAnchor="middle"
            fill="#DC2626"
            fontSize="15.5"
            fontWeight="800"
            fontFamily="system-ui, -apple-system, 'Microsoft YaHei', sans-serif"
          >
            易
          </text>
        </svg>
      );
    case "feishu":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12.2L13.6 4.5L18.8 9.2L10.2 16.9L5 12.2Z"
            fill="#00D6B9"
          />
          <path
            d="M9.8 14.2L16.2 8.4L19 11.4L12.6 19.2L9.8 14.2Z"
            fill="#3370FF"
          />
        </svg>
      );
    case "mail263":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <text
            x="12"
            y="15.4"
            textAnchor="middle"
            fill="#1D4ED8"
            fontSize="10.2"
            fontWeight="800"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            263
          </text>
        </svg>
      );
    case "zoho_exmail":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M7.5 7H16.5L7.5 17H16.5"
            stroke="#E11D48"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return null;
  }
}
