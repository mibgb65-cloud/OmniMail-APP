import logoDarkSvg from "../../assets/brand/logo-dark.svg";
import logoSvg from "../../assets/brand/logo.svg";

interface BrandLogoProps {
  size?: number;
  showWordmark?: boolean;
}

export function BrandLogo({ size = 28, showWordmark = true }: BrandLogoProps) {
  const radius = Math.max(6, Math.round(size * 0.22));
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
        className="brand-logo-wrap"
        style={{
          position: "relative",
          width: size,
          height: size,
          display: "inline-block",
          flexShrink: 0,
          borderRadius: radius,
          overflow: "hidden",
        }}
      >
        <img
          src={logoSvg}
          alt="OmniMail 品牌标志"
          width={size}
          height={size}
          className="brand-logo-img brand-logo-light"
        />
        <img
          src={logoDarkSvg}
          alt=""
          aria-hidden="true"
          width={size}
          height={size}
          className="brand-logo-img brand-logo-dark"
        />
      </span>
      {showWordmark && <span className="brand-wordmark">OmniMail</span>}
    </div>
  );
}
