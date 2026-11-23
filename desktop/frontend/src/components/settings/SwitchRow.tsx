export function SwitchRow({
  heading,
  desc,
  checked,
  disabled,
  onChange,
}: {
  heading: string;
  desc?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="settings-row">
      <div>
        <div
          style={{ fontSize: 13, fontWeight: 600, color: "var(--text-ink)" }}
        >
          {heading}
        </div>
        {desc && (
          <div
            className="text-xs text-muted"
            style={{ marginTop: 2, lineHeight: 1.5 }}
          >
            {desc}
          </div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={heading}
        disabled={disabled}
        className={`switch-btn${checked ? " on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="switch-knob" />
      </button>
    </div>
  );
}
