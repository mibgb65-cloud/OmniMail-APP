export const MUSE_LOGIN_POLL_INTERVAL_MS = 1500;
export const MUSE_DEFAULT_ACCOUNT_NAME = "Muse";

export interface MuseAutoPollGuardInput {
  loginStage: "idle" | "login_open" | "verified" | "connected";
  verifiedEmail: string;
  openingLogin: boolean;
  busy: boolean;
  autoVerifyTried: boolean;
  aborted: boolean;
}

/**
 * 判断 MuseConnectModal 当前是否应启动/继续 1500ms 温和会话就绪轮询。
 * 一旦自动验证已尝试（即使失败），立即停止轮询避免死循环，保留手动重试按钮。
 */
export function shouldPollMuseLoginSession(
  input: MuseAutoPollGuardInput,
): boolean {
  if (input.aborted || input.openingLogin || input.busy) return false;
  if (input.verifiedEmail) return false;
  if (input.autoVerifyTried) return false;
  return input.loginStage === "login_open";
}

export function resolveInitialMuseAccountName(currentName: string): string {
  return currentName.trim() ? currentName : MUSE_DEFAULT_ACCOUNT_NAME;
}
