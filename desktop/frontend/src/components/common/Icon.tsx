import { appIcons } from "./iconRegistry";

export type IconName = keyof typeof appIcons;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 16, className }: IconProps) {
  const Glyph = appIcons[name];
  return (
    <Glyph
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0 }}
    />
  );
}
