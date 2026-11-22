export type SyncStage =
  "testing" | "connected" | "failed" | "syncing" | "partial" | "done";

export interface SyncStageInfo {
  title: string;
  badge: string;
  tone: string;
  desc: string;
  progress: number;
}

export const SYNC_STAGE_INFO: Record<SyncStage, SyncStageInfo> = {
  testing: {
    title: "正在测试 IMAP / SMTP 安全连接…",
    badge: "连接测试中",
    tone: "pill-accent",
    desc: "正在校验 TLS 证书、服务器握手与凭据有效性。",
    progress: 24,
  },
  connected: {
    title: "连接测试通过，准备开始首次同步",
    badge: "连接成功",
    tone: "pill-success",
    desc: "IMAP 与 SMTP 均已握手成功，凭据已安全存入系统凭据库。",
    progress: 45,
  },
  failed: {
    title: "连接测试失败（认证或端口异常）",
    badge: "连接失败",
    tone: "pill-danger",
    desc: "服务器返回 AUTHENTICATIONFAILED。请确认已填写 16 位客户端授权码或应用专用密码，而非网页登录密码。",
    progress: 24,
  },
  syncing: {
    title: "正在拉取最近 90 天邮件并构建本地索引…",
    badge: "首次同步中",
    tone: "pill-accent",
    desc: "已同步 186 / 240 封邮件 · 附件保持按需缓存，不阻塞阅读。",
    progress: 76,
  },
  partial: {
    title: "部分文件夹同步完成（1 个子目录超时）",
    badge: "部分同步失败",
    tone: "pill-warning",
    desc: "收件箱与已发送已就绪；归档文件夹因服务端限流稍后将自动增量补齐。",
    progress: 88,
  },
  done: {
    title: "首次同步完成，账户已接入统一收件箱",
    badge: "同步完成",
    tone: "pill-success",
    desc: "共同步 240 封邮件与 12 个联系人记录，你可以立即开始浏览与回复。",
    progress: 100,
  },
};

export const ALL_SYNC_STAGES: Array<{ id: SyncStage; label: string }> = [
  { id: "testing", label: "测试中" },
  { id: "connected", label: "连接成功" },
  { id: "failed", label: "连接失败" },
  { id: "syncing", label: "首次同步" },
  { id: "partial", label: "部分失败" },
  { id: "done", label: "同步完成" },
];
