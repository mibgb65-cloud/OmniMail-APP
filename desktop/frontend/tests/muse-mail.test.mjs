import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { PROVIDER_CATALOG } from "../src/data/providers.ts";
import { enUS, setCurrentLanguage, zhCN } from "../src/i18n/index.ts";
import { parseBackendError } from "../src/services/errorParser.ts";
import {
  classifyMuseViewState,
  formatMuseByteSize,
  MUSE_OFFICIAL_GUIDE_URL,
  splitMuseBodyParagraphs,
} from "../src/types/muse.ts";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("Muse Mail 官方品牌 SVG、接入弹窗文案与无实验性/安全边界警示词校验", () => {
  const svg = readFileSync(
    path.join(rootDir, "src", "assets", "providers", "muse.svg"),
    "utf8",
  );
  assert.match(svg, /fill="#0064E0"/i);
  assert.match(svg, /viewBox="0 0 100 100"/);
  assert.match(MUSE_OFFICIAL_GUIDE_URL, /^https:\/\/www\.meta\.com\/help\//);

  // 严禁混入标准 IMAP 预设目录
  assert.equal(
    PROVIDER_CATALOG.some((p) => p.id === "muse"),
    false,
  );

  // 核心中文规范词条严格对齐
  assert.equal(zhCN.muse.connectHeading, "连接 Muse Mail");
  assert.equal(zhCN.muse.summaryPill, "独立网页登录 · 仅客户端接入");
  assert.equal(zhCN.muse.loginCardTitle, "专用登录窗口");
  assert.equal(zhCN.muse.openLoginWindowBtn, "打开 Muse 登录窗口");
  assert.equal(zhCN.muse.sessionVerifiedPill, "会话已核验");
  assert.equal(
    zhCN.muse.connectionModeValue,
    "内置原生网关（自动握手 · 只读查看邮件）",
  );
  assert.equal(zhCN.muse.verifyAndConnectBtn, "验证并连接");
  assert.equal(zhCN.muse.timeUnknown, "时间未知");

  // 严禁在界面展示「实验性」或「非官方接口 / 安全边界」警示词
  const bannedZh = /实验性|非官方|安全边界/;
  const bannedEn = /experimental|unofficial|security boundary/i;
  for (const [k, v] of Object.entries(zhCN.muse)) {
    assert.doesNotMatch(v, bannedZh, `zhCN.muse.${k} contains banned wording`);
  }
  for (const [k, v] of Object.entries(enUS.muse)) {
    assert.doesNotMatch(v, bannedEn, `enUS.muse.${k} contains banned wording`);
    assert.doesNotMatch(v, /[\u4e00-\u9fff]/, `enUS.muse.${k} leaked CJK`);
  }
});

test("Muse Mail 只读视图 6 种状态分流、脱敏错误码双语解析与正文归一化", () => {
  assert.equal(
    classifyMuseViewState({
      bound: true,
      clearedBySessionReset: false,
      threadsCount: 0,
      loading: false,
    }),
    "empty",
  );
  assert.equal(
    classifyMuseViewState({
      bound: true,
      clearedBySessionReset: false,
      errorCode: "ERR_MUSE_NOT_ENABLED",
      threadsCount: 0,
      loading: false,
    }),
    "not_enabled",
  );
  assert.equal(
    classifyMuseViewState({
      bound: true,
      clearedBySessionReset: false,
      errorCode: "ERR_MUSE_AUTH_EXPIRED",
      threadsCount: 2,
      loading: false,
    }),
    "auth_expired",
  );
  assert.equal(
    classifyMuseViewState({
      bound: false,
      clearedBySessionReset: false,
      errorCode: "ERR_MUSE_IDENTITY_CHANGED",
      threadsCount: 0,
      loading: false,
    }),
    "identity_changed",
  );
  assert.equal(
    classifyMuseViewState({
      bound: true,
      clearedBySessionReset: false,
      errorCode: "ERR_MUSE_GATEWAY_TIMEOUT",
      threadsCount: 0,
      loading: false,
    }),
    "gateway_error",
  );
  assert.equal(
    classifyMuseViewState({
      bound: false,
      clearedBySessionReset: true,
      threadsCount: 0,
      loading: false,
    }),
    "session_cleared",
  );
  assert.equal(
    classifyMuseViewState({
      bound: true,
      clearedBySessionReset: false,
      threadsCount: 3,
      loading: false,
    }),
    "ready",
  );

  setCurrentLanguage("en-US");
  try {
    const parsed = parseBackendError(
      new Error("[ERR_MUSE_NOT_ENABLED] 当前未开通"),
    );
    assert.equal(parsed.code, "ERR_MUSE_NOT_ENABLED");
    assert.doesNotMatch(parsed.message, /[\u4e00-\u9fff]/);
  } finally {
    setCurrentLanguage("zh-CN");
  }

  assert.deepEqual(splitMuseBodyParagraphs("Hello\r\n\r\nWorld\n\n!"), [
    "Hello",
    "World",
    "!",
  ]);
  assert.equal(formatMuseByteSize(1536), "1.5 KB");
});

test("Muse Mail 只读视图与侧栏组件不含写操作按钮、伪造未读点与原生控件", () => {
  const sidebarMuse = readFileSync(
    path.join(rootDir, "src", "components", "shell", "SidebarMuseSection.tsx"),
    "utf8",
  );
  assert.doesNotMatch(sidebarMuse, /account-status-dot|account-unread-count/);

  const readerSrc = readFileSync(
    path.join(rootDir, "src", "components", "muse", "MuseThreadReaderPane.tsx"),
    "utf8",
  );
  assert.doesNotMatch(
    readerSrc,
    /openReply|openForward|moveToTrash|mail-source|requestAiAction/,
  );
});
