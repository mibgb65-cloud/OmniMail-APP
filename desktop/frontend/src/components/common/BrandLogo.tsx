import logoSvg from "../../assets/brand/logo.svg";

interface BrandLogoProps {
  size?: number;
  showWordmark?: boolean;
}

export function BrandLogo({ size = 28, showWordmark = true }: BrandLogoProps) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <img
        src={logoSvg}
        alt="OmniMail 品牌标志"
        width={size}
        height={size}
        style={{ display: "block", flexShrink: 0, borderRadius: 7 }}
      />
      {showWordmark && <span className="brand-wordmark">OmniMail</span>}
    </div>
  );
}
