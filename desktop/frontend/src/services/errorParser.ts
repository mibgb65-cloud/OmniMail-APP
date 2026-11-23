export interface ParsedBackendError {
  code: string;
  message: string;
}

export function parseBackendError(err: unknown): ParsedBackendError {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "发生未知本地服务异常";
  const match = /^\[(ERR_[A-Z0-9_]+)\]\s*(.*)$/.exec(raw.trim());
  if (match) {
    return {
      code: match[1] ?? "",
      message: match[2] || raw,
    };
  }
  return { code: "", message: raw };
}
