interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <img
      className={className}
      src="/brand/omnimail.svg"
      width="64"
      height="64"
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
