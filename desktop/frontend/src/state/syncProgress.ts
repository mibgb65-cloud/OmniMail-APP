export interface LiveSyncProgress {
  accountId: string;
  status: "syncing" | "done" | "failed" | "partial";
  stage: string;
  current: number;
  total: number;
}

export function isLiveSyncProgress(data: unknown): data is LiveSyncProgress {
  if (!data || typeof data !== "object") return false;
  const { accountId, status, stage, current, total } =
    data as Partial<LiveSyncProgress>;
  return (
    typeof accountId === "string" &&
    accountId.length > 0 &&
    accountId.length <= 128 &&
    (status === "syncing" ||
      status === "done" ||
      status === "failed" ||
      status === "partial") &&
    typeof stage === "string" &&
    stage.length <= 128 &&
    typeof current === "number" &&
    Number.isSafeInteger(current) &&
    current >= 0 &&
    typeof total === "number" &&
    Number.isSafeInteger(total) &&
    total >= current
  );
}
