import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { PROVIDER_CATALOG } from "../src/data/providers.ts";
import { enUS, setCurrentLanguage, zhCN } from "../src/i18n/index.ts";
import { parseBackendError } from "../src/services/errorParser.ts";
import { mapMailboxStatus } from "../src/services/workBuddyMappers.ts";
import {
  deriveConnectModalState,
  EMPTY_DAILY_QUOTA,
  markMessageReadInList,
  removeDeletedMessageFromState,
  shouldShowDailyQuota,
  WORKBUDDY_OFFICIAL_GUIDE_URL,
} from "../src/types/workbuddy.ts";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("WorkBuddy 官方品牌 PNG 尺寸、双栏设计稿文案与零实验性/私有协议警示词校验", () => {
  const png = readFileSync(
    path.join(rootDir, "src", "assets", "providers", "workbuddy.png"),
  );
  // PNG 魔数 + IHDR 宽高应为 128x128
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), 128);
  assert.equal(png.readUInt32BE(20), 128);
  assert.equal(WORKBUDDY_OFFICIAL_GUIDE_URL, "https://www.workbuddy.cn");

  // 严禁混入标准 IMAP/SMTP 预设目录或写信发件人列表
  assert.equal(
    PROVIDER_CATALOG.some((p) => p.id === "workbuddy"),
    false,
  );

  // 对齐 OpenPencil 09 · 邮箱接入指引 核心文案
  assert.equal(zhCN.workbuddy.providerName, "WorkBuddy Agent 邮箱");
  assert.equal(zhCN.workbuddy.connectHeading, "连接 WorkBuddy 邮箱");
  assert.equal(zhCN.workbuddy.summaryPill, "浏览器授权 · 仅客户端接入");
  assert.equal(zhCN.workbuddy.authCardTitle, "腾讯 WorkBuddy 官方授权");
  assert.equal(zhCN.workbuddy.startAuthBtn, "前往浏览器授权");
  assert.equal(zhCN.workbuddy.authVerifiedPill, "授权已核验");
  assert.equal(zhCN.workbuddy.defaultAccountName, "WorkBuddy 智能体邮箱");
  assert.equal(
    zhCN.workbuddy.connectionModeValue,
    "内置原生 REST 网关（HTTPS 自动续期 · 收发记录与附件下载）",
  );
  assert.equal(zhCN.workbuddy.completeConnectBtn, "完成并接入");

  const bannedZh = /实验性|Beta|私有协议|安全边界/i;
  const bannedEn = /experimental|\bbeta\b|private protocol|security boundary/i;
  for (const [k, v] of Object.entries(zhCN.workbuddy)) {
    assert.doesNotMatch(
      v,
      bannedZh,
      `zhCN.workbuddy.${k} contains banned copy`,
    );
  }
  for (const [k, v] of Object.entries(enUS.workbuddy)) {
    assert.doesNotMatch(
      v,
      bannedEn,
      `enUS.workbuddy.${k} contains banned copy`,
    );
    assert.doesNotMatch(v, /[\u4e00-\u9fff]/, `enUS.workbuddy.${k} leaked CJK`);
  }
});

test("WorkBuddyConnectModal 状态流转与双语错误码映射校验", () => {
  assert.equal(mapMailboxStatus("active"), "running");
  assert.equal(mapMailboxStatus("running"), "running");
  assert.equal(mapMailboxStatus("forbidden"), "banned");
  const idle = deriveConnectModalState({
    stage: "idle",
    detectedEmail: "",
    busy: false,
  });
  assert.equal(idle.isPolling, false);
  assert.equal(idle.isAuthorized, false);
  assert.equal(idle.canSubmit, false);

  const polling = deriveConnectModalState({
    stage: "polling",
    detectedEmail: "",
    busy: false,
  });
  assert.equal(polling.isPolling, true);
  assert.equal(polling.pillTone, "info");
  assert.equal(polling.canSubmit, false);

  const notBound = deriveConnectModalState({
    stage: "not_bound",
    detectedEmail: "",
    busy: false,
  });
  assert.equal(notBound.isNotBound, true);
  assert.equal(notBound.canSubmit, false);

  const authorized = deriveConnectModalState({
    stage: "authorized",
    detectedEmail: "agent-work@mail.workbuddy.cn",
    busy: false,
  });
  assert.equal(authorized.isAuthorized, true);
  assert.equal(authorized.pillTone, "success");
  assert.equal(authorized.canSubmit, true);

  const busyAuthorized = deriveConnectModalState({
    stage: "authorized",
    detectedEmail: "agent-work@mail.workbuddy.cn",
    busy: true,
  });
  assert.equal(busyAuthorized.canSubmit, false);

  setCurrentLanguage("en-US");
  try {
    const parsed = parseBackendError(
      new Error("[ERR_WB_NOT_BOUND] 当前账号尚未开通"),
    );
    assert.equal(parsed.code, "ERR_WB_NOT_BOUND");
    assert.doesNotMatch(parsed.message, /[\u4e00-\u9fff]/);
  } finally {
    setCurrentLanguage("zh-CN");
  }
});

test("WorkBuddyMailView 列表已读状态、配额显隐、两步删除确认与无回复转发按钮校验", () => {
  assert.equal(shouldShowDailyQuota(EMPTY_DAILY_QUOTA), false);
  assert.equal(
    shouldShowDailyQuota({
      limit: 100,
      remaining: 80,
      reset: 0,
      hasQuota: true,
    }),
    true,
  );

  const sampleList = [
    {
      messageId: "m1",
      subject: "Hello",
      from: "a@b.com",
      to: [],
      snippet: "hi",
      createdAt: "",
      isRead: false,
      hasAttachments: true,
      direction: "inbox",
    },
    {
      messageId: "m2",
      subject: "Second",
      from: "c@d.com",
      to: [],
      snippet: "yo",
      createdAt: "",
      isRead: true,
      hasAttachments: false,
      direction: "inbox",
    },
  ];
  const marked = markMessageReadInList(sampleList, "m1");
  assert.equal(marked[0].isRead, true);

  const afterDel = removeDeletedMessageFromState(marked, "m1", "m1");
  assert.equal(afterDel.items.length, 1);
  assert.equal(afterDel.nextSelectedId, "m2");

  const modalSrc = readFileSync(
    path.join(
      rootDir,
      "src",
      "components",
      "onboarding",
      "WorkBuddyConnectModal.tsx",
    ),
    "utf8",
  );
  assert.match(modalSrc, /ProviderConnectShell/);
  assert.match(modalSrc, /PreparationGuideCard/);

  const readerSrc = readFileSync(
    path.join(
      rootDir,
      "src",
      "components",
      "workbuddy",
      "WorkBuddyReaderPane.tsx",
    ),
    "utf8",
  );
  assert.match(readerSrc, /SafeMailHtmlView/);
  assert.match(readerSrc, /useReaderLinkHandlers/);
  assert.doesNotMatch(readerSrc, /openReply|openForward|openNewCompose/);
});
