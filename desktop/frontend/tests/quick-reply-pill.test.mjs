import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  evaluateQuickReplyPillStage,
  resolveQuickReplyIdentity,
} from "../src/components/mail/reader/useQuickReplyPillLayout.ts";
import { translateWithLang } from "../src/i18n/index.ts";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("快速回复发件锁定胶囊：中英文前缀拆分、无尾部多余发送字样、Tooltip 与收起态邮箱回退", () => {
  const qqAccount = {
    name: "个人订阅",
    providerLabel: "QQ 邮箱",
    email: "19840213@qq.com",
  };

  const zh = resolveQuickReplyIdentity(qqAccount, "zh-CN");
  assert.equal(zh.prefixText, "通过 QQ 邮箱 · ");
  assert.equal(zh.coreEmail, "19840213@qq.com");
  assert.equal(
    zh.tooltipText,
    "已锁定原收件账户 · 通过 QQ 邮箱 · 19840213@qq.com",
  );
  assert.equal(zh.collapsedAccountText, "19840213@qq.com");
  assert.doesNotMatch(zh.prefixText + zh.coreEmail, /发送$/);

  const collapsedZh = translateWithLang(
    "zh-CN",
    "reader.quickReplyCollapsedHeader",
    { sender: "张宁", account: zh.collapsedAccountText },
  );
  assert.equal(collapsedZh, "回复 张宁（锁定 19840213@qq.com）…");

  const en = resolveQuickReplyIdentity(qqAccount, "en-US");
  assert.equal(en.prefixText, "Via QQ Mail · ");
  assert.equal(en.coreEmail, "19840213@qq.com");
  assert.equal(
    en.tooltipText,
    "Locked to original account · Via QQ Mail · 19840213@qq.com",
  );
  assert.doesNotMatch(en.tooltipText, /[\u4e00-\u9fff]/);

  // providerLabel 与 email 缺失时的安全回退
  const fallback = resolveQuickReplyIdentity(
    { name: "团队内网箱", providerLabel: "", email: "" },
    "zh-CN",
  );
  assert.equal(fallback.providerLabel, "团队内网箱");
  assert.equal(fallback.coreEmail, "团队内网箱");
});

test("快速回复发件锁定胶囊：3 级自适应宽度渐进降级与临界防抖迟滞", () => {
  const baseMetrics = {
    titleNaturalWidth: 120,
    fullPillWidth: 268,
    emailOnlyPillWidth: 168,
    collapseBtnWidth: 0,
  };

  // 状态 01（宽裕态）：460 - 120 - 10 = 330 >= 268 -> 完整显示前缀 + 邮箱
  const spacious = evaluateQuickReplyPillStage({
    ...baseMetrics,
    headerWidth: 460,
  });
  assert.equal(spacious.stage, "full");
  assert.equal(spacious.hidePrefix, false);
  assert.equal(spacious.emailTruncated, false);

  // 状态 02（较挤态）：350 - 120 - 10 = 220 (< 268 且 >= 168) -> 自动隐藏前缀，完整保留邮箱
  const cozy = evaluateQuickReplyPillStage({
    ...baseMetrics,
    headerWidth: 350,
  });
  assert.equal(cozy.stage, "email-only");
  assert.equal(cozy.hidePrefix, true);
  assert.equal(cozy.emailTruncated, false);

  // 状态 03（极端窄屏兜底）：260 - 120 - 10 = 130 (< 168) -> 隐藏前缀且邮箱单行省略
  const narrow = evaluateQuickReplyPillStage({
    ...baseMetrics,
    headerWidth: 260,
  });
  assert.equal(narrow.stage, "ellipsis");
  assert.equal(narrow.hidePrefix, true);
  assert.equal(narrow.emailTruncated, true);

  // 含「收起」按钮时扣除按钮与间距后再判断
  const withCollapse = evaluateQuickReplyPillStage({
    ...baseMetrics,
    headerWidth: 430,
    collapseBtnWidth: 52,
  });
  assert.equal(withCollapse.stage, "email-only");

  // 迟滞防抖：从 email-only 回到 full 需额外满足 6px 缓冲，避免临界点闪烁
  const nearThreshold = evaluateQuickReplyPillStage(
    { ...baseMetrics, headerWidth: 120 + 10 + 270 },
    "email-only",
  );
  assert.equal(nearThreshold.stage, "email-only");
  const pastHysteresis = evaluateQuickReplyPillStage(
    { ...baseMetrics, headerWidth: 120 + 10 + 275 },
    "email-only",
  );
  assert.equal(pastHysteresis.stage, "full");
});

test("样式表已彻底移除 240px / 260px 硬编码上限且挂载 Tooltip 与 bare 图标", () => {
  const extrasCss = readFileSync(
    path.join(rootDir, "src", "styles", "mail-reader-extras.css"),
    "utf8",
  );
  const i18nCss = readFileSync(
    path.join(rootDir, "src", "styles", "i18n-layout.css"),
    "utf8",
  );
  assert.doesNotMatch(extrasCss, /max-width:\s*240px/);
  assert.doesNotMatch(i18nCss, /min\(260px,\s*58%\)/);

  const headerSrc = readFileSync(
    path.join(
      rootDir,
      "src",
      "components",
      "mail",
      "reader",
      "QuickReplyHeader.tsx",
    ),
    "utf8",
  );
  assert.match(
    headerSrc,
    /<Tooltip label=\{identity\.tooltipText\} placement="top">/,
  );
  assert.match(
    headerSrc,
    /<ProviderIcon provider=\{provider\} size=\{15\} bare \/>/,
  );
});
