import { useI18n } from "../../i18n";
import { scrollViewportToTop } from "../../state/mailListArrivalPolicy";
import { Icon } from "./Icon";

export { scrollViewportToTop };

interface ScrollToTopPillProps {
  visible: boolean;
  onClick: () => void;
  label?: string;
  ariaLabel?: string;
  accent?: boolean;
  className?: string;
}

export function ScrollToTopPill({
  visible,
  onClick,
  label,
  ariaLabel,
  accent = false,
  className,
}: ScrollToTopPillProps) {
  const { t } = useI18n();
  const resolvedLabel = label ?? t("common.backToTop");
  const resolvedAria = ariaLabel ?? resolvedLabel;

  return (
    <button
      type="button"
      className={`scroll-to-top-pill${className ? ` ${className}` : ""}`}
      data-visible={visible}
      data-new-mail={accent}
      aria-hidden={!visible}
      disabled={!visible}
      tabIndex={visible ? 0 : -1}
      aria-label={resolvedAria}
      onClick={onClick}
    >
      <Icon name="arrowUp" size={13} />
      {resolvedLabel}
    </button>
  );
}
