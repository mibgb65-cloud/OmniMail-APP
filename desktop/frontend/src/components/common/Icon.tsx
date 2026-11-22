import { ICON_PATHS_CORE } from "./iconPathsCore";
import { ICON_PATHS_EXTRA } from "./iconPathsExtra";

const ALL_PATHS: Record<string, string> = {
  ...ICON_PATHS_CORE,
  ...ICON_PATHS_EXTRA,
};

export type IconName =
  keyof typeof ICON_PATHS_CORE | keyof typeof ICON_PATHS_EXTRA;

interface IconProps {
  name: IconName;
  size?: number;
  filled?: boolean;
  className?: string;
}

export function Icon({
  name,
  size = 16,
  filled = false,
  className,
}: IconProps) {
  const d = ALL_PATHS[name] ?? ALL_PATHS.mail;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d={d} />
    </svg>
  );
}
