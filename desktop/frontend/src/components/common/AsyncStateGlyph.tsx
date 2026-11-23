export type AsyncActionStatus = "idle" | "loading" | "success" | "error";

export function waitSuccessHold(ms = 900): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function AsyncStateGlyph({
  status,
  size = 16,
  progress,
}: {
  status: Exclude<AsyncActionStatus, "idle">;
  size?: number;
  progress?: number;
}) {
  const hasDeterminate =
    status === "loading" &&
    typeof progress === "number" &&
    progress > 0 &&
    progress < 100;
  const pctOffset = hasDeterminate
    ? Math.max(2, 44 - (44 * Math.min(99, Math.max(4, progress))) / 100)
    : 14;

  return (
    <svg
      className="async-state-svg"
      data-glyph={status}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      {status === "loading" && (
        <>
          <circle
            cx="10"
            cy="10"
            r="7"
            stroke="currentColor"
            strokeOpacity="0.26"
            strokeWidth="1.8"
          />
          <circle
            className={
              hasDeterminate ? "async-ring-progress" : "async-ring-spin"
            }
            cx="10"
            cy="10"
            r="7"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeDasharray={hasDeterminate ? "44 44" : "30 44"}
            strokeDashoffset={hasDeterminate ? pctOffset : undefined}
          />
        </>
      )}

      {status === "success" && (
        <>
          <circle
            className="async-halo-ring"
            cx="10"
            cy="10"
            r="7"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle
            className="async-close-ring"
            cx="10"
            cy="10"
            r="7"
            stroke="currentColor"
            strokeOpacity="0.72"
            strokeWidth="1.55"
            strokeLinecap="round"
          />
          <path
            className="async-check-path"
            d="M6.2 10.3 L8.9 13 L14.2 7.5"
            stroke="currentColor"
            strokeWidth="1.95"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {status === "error" && (
        <>
          <circle
            cx="10"
            cy="10"
            r="7"
            stroke="currentColor"
            strokeOpacity="0.48"
            strokeWidth="1.55"
          />
          <path
            className="async-cross-path"
            d="M7.3 7.3 L12.7 12.7 M12.7 7.3 L7.3 12.7"
            stroke="currentColor"
            strokeWidth="1.85"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}
