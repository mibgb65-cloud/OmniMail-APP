import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

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
            strokeWidth="1.5"
          />
          <circle
            className={
              hasDeterminate ? "async-ring-progress" : "async-ring-spin"
            }
            cx="10"
            cy="10"
            r="7"
            stroke="currentColor"
            strokeWidth="1.5"
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
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <CheckIcon
            className="async-check-shape"
            x={3}
            y={3}
            width={14}
            height={14}
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
            strokeWidth="1.5"
          />
          <XMarkIcon
            className="async-cross-shape"
            x={4}
            y={4}
            width={12}
            height={12}
          />
        </>
      )}
    </svg>
  );
}
