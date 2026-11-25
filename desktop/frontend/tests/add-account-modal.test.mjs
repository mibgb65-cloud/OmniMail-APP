import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  countProvidersByCategory,
  filterPickerDirectory,
  isConnectSuiteOverlay,
  resolveConnectSuiteStageKey,
  resolveProviderTargetOverlay,
} from "../src/components/onboarding/addAccountCatalog.ts";
import {
  ALL_PROVIDER_PRESETS,
  mergePickerPresets,
  PROVIDER_CATALOG,
  PROVIDERS_AGENT,
  resolveProviderCategory,
} from "../src/data/providers.ts";
import { enUS, localizeProviderPreset, zhCN } from "../src/i18n/index.ts";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("添加邮箱双栏选型：分类回退兼容、AI Agent / 传统分类统计与奇数补位校验", () => {
  // 旧结构未带 category 字段时自动回退为 standard
  const legacyPresets = PROVIDER_CATALOG.map((p) => {
    const copy = { ...p };
    delete copy.category;
    return copy;
  });
  for (const item of legacyPresets) {
    assert.equal(resolveProviderCategory(item), "standard");
  }

  const merged = mergePickerPresets(legacyPresets);
  const counts = countProvidersByCategory(merged);
  assert.equal(counts.agent, PROVIDERS_AGENT.length);
  assert.equal(counts.standard, 9);
  assert.equal(counts.total, 11);

  // 全部服务商且无搜索词：展示 AI Agent 与传统分组，且 9 家奇数传统邮箱自动开启补位自定义卡
  const allView = filterPickerDirectory(merged, "all", "");
  assert.equal(allView.matched.length, 11);
  assert.equal(allView.agentItems.length, 2);
  assert.equal(allView.standardItems.length, 9);
  assert.equal(allView.showCustomBalanceCard, true);

  // 切换至 AI Agent 邮箱分类
  const agentView = filterPickerDirectory(merged, "agent", "");
  assert.deepEqual(
    agentView.matched.map((p) => p.id),
    ["workbuddy", "muse"],
  );
  assert.equal(agentView.showCustomBalanceCard, false);

  // 切换至传统与常用邮箱分类
  const stdView = filterPickerDirectory(merged, "standard", "");
  assert.equal(stdView.matched.length, 9);
  assert.equal(stdView.showCustomBalanceCard, true);
});

test("添加邮箱双栏选型：关键词搜索（名称 / 域名后缀 / badgeText）与空态重置", () => {
  const enPresets = ALL_PROVIDER_PRESETS.map((p) =>
    localizeProviderPreset(p, "en-US"),
  );
  for (const item of enPresets) {
    assert.doesNotMatch(
      item.name + item.subtitle + item.badgeText,
      /[\u4e00-\u9fff]/,
      `${item.id} English preset leaked CJK`,
    );
  }

  // 按域名后缀搜索
  const foxmailHit = filterPickerDirectory(
    ALL_PROVIDER_PRESETS,
    "all",
    "foxmail.com",
  );
  assert.deepEqual(
    foxmailHit.matched.map((p) => p.id),
    ["qq"],
  );
  // 搜索过滤态下不补位自定义卡片
  assert.equal(foxmailHit.showCustomBalanceCard, false);

  // 按 badgeText 搜索
  const oauthHit = filterPickerDirectory(
    ALL_PROVIDER_PRESETS,
    "standard",
    "浏览器授权",
  );
  assert.deepEqual(
    oauthHit.matched.map((p) => p.id),
    ["gmail", "outlook"],
  );

  // 搜索无结果空态
  const emptyHit = filterPickerDirectory(
    ALL_PROVIDER_PRESETS,
    "all",
    "non-existent-provider-xyz",
  );
  assert.equal(emptyHit.matched.length, 0);
  assert.equal(emptyHit.hasQuery, true);
  assert.equal(emptyHit.showCustomBalanceCard, false);
});

test("点击服务商跳转目标接入模态框、手动 IMAP 入口与 980×760 零跳动样式门禁", () => {
  const byId = Object.fromEntries(ALL_PROVIDER_PRESETS.map((p) => [p.id, p]));
  assert.deepEqual(resolveProviderTargetOverlay(byId.workbuddy), {
    type: "workbuddy-connect",
  });
  assert.deepEqual(resolveProviderTargetOverlay(byId.muse), {
    type: "muse-connect",
  });
  assert.deepEqual(resolveProviderTargetOverlay(byId.gmail), {
    type: "oauth-flow",
    provider: "gmail",
    stage: "waiting",
  });
  assert.deepEqual(resolveProviderTargetOverlay(byId.qq), {
    type: "provider-guide",
    provider: "qq",
  });

  // 同尺寸弹窗族共享 connect-suite 外层遮罩，避免销毁闪烁
  assert.equal(isConnectSuiteOverlay({ type: "add-account" }), true);
  assert.equal(isConnectSuiteOverlay({ type: "manual-imap" }), true);
  assert.equal(isConnectSuiteOverlay({ type: "workbuddy-connect" }), true);
  assert.equal(
    resolveConnectSuiteStageKey({ type: "provider-guide", provider: "qq" }),
    "provider-guide:qq",
  );

  // 双语文案与零实验性/安全边界警告校验
  assert.equal(zhCN.onboarding.pickerCatAgent, "AI Agent 邮箱");
  assert.equal(zhCN.onboarding.pickerCatStandard, "传统与常用邮箱");
  assert.equal(enUS.onboarding.pickerCatAgent, "AI Agent Mail");

  const modalSrc = readFileSync(
    path.join(
      rootDir,
      "src",
      "components",
      "onboarding",
      "AddAccountModal.tsx",
    ),
    "utf8",
  );
  const sideSrc = readFileSync(
    path.join(
      rootDir,
      "src",
      "components",
      "onboarding",
      "AddAccountSidebar.tsx",
    ),
    "utf8",
  );
  assert.match(modalSrc, /pcm-modal-card/);
  assert.match(modalSrc, /manual-imap/);
  assert.match(sideSrc, /onOpenManualImap/);
  assert.doesNotMatch(modalSrc + sideSrc, /实验性|安全边界/);

  const pcmCss = readFileSync(
    path.join(rootDir, "src", "styles", "provider-connect-modal.css"),
    "utf8",
  );
  const aamCss = readFileSync(
    path.join(rootDir, "src", "styles", "add-account-modal.css"),
    "utf8",
  );
  const cardsCss = readFileSync(
    path.join(rootDir, "src", "styles", "add-account-cards.css"),
    "utf8",
  );
  assert.match(pcmCss, /height:\s*min\(760px,\s*calc\(100vh\s*-\s*36px\)\)/);
  assert.match(aamCss, /grid-template-columns:\s*228px\s+minmax\(0,\s*1fr\)/);
  assert.match(aamCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(cardsCss, /@media\s*\(max-width:\s*759px\)/);
});
