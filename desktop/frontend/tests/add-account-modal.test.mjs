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
  isEnterpriseProviderId,
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

test("添加邮箱双栏选型：三分类统计、企业邮箱分组与奇数补位校验", () => {
  const legacyPresets = PROVIDER_CATALOG.map((p) => {
    const copy = { ...p };
    delete copy.category;
    return copy;
  });
  for (const item of legacyPresets) {
    const expected = isEnterpriseProviderId(item.id)
      ? "enterprise"
      : "standard";
    assert.equal(resolveProviderCategory(item), expected);
  }

  const merged = mergePickerPresets(legacyPresets);
  const counts = countProvidersByCategory(merged);
  assert.equal(counts.agent, PROVIDERS_AGENT.length);
  assert.equal(counts.standard, 9);
  assert.equal(counts.enterprise, 6);
  assert.equal(counts.total, 17);

  const allView = filterPickerDirectory(merged, "all", "");
  assert.equal(allView.matched.length, 17);
  assert.equal(allView.agentItems.length, 2);
  assert.equal(allView.standardItems.length, 9);
  assert.equal(allView.enterpriseItems.length, 6);
  assert.equal(allView.showCustomBalanceCard, true);

  const agentView = filterPickerDirectory(merged, "agent", "");
  assert.deepEqual(
    agentView.matched.map((p) => p.id),
    ["workbuddy", "muse"],
  );
  assert.equal(agentView.showCustomBalanceCard, false);

  const stdView = filterPickerDirectory(merged, "standard", "");
  assert.equal(stdView.matched.length, 9);
  assert.equal(stdView.showCustomBalanceCard, true);

  const entView = filterPickerDirectory(merged, "enterprise", "");
  assert.deepEqual(
    entView.matched.map((p) => p.id),
    [
      "tencent_exmail",
      "aliyun_exmail",
      "netease_exmail",
      "feishu",
      "mail263",
      "zoho_exmail",
    ],
  );
  assert.equal(entView.showCustomBalanceCard, false);
});

test("添加邮箱双栏选型：个人与企业关键词搜索及空态校验", () => {
  for (const p of ALL_PROVIDER_PRESETS) {
    const item = localizeProviderPreset(p, "en-US");
    assert.doesNotMatch(
      item.name + item.subtitle + item.badgeText,
      /[\u4e00-\u9fff]/,
    );
  }

  const foxmailHit = filterPickerDirectory(
    ALL_PROVIDER_PRESETS,
    "all",
    "foxmail.com",
  );
  assert.deepEqual(
    foxmailHit.matched.map((p) => p.id),
    ["qq"],
  );
  assert.equal(foxmailHit.showCustomBalanceCard, false);

  const exmailHit = filterPickerDirectory(
    ALL_PROVIDER_PRESETS,
    "all",
    "exmail.qq.com",
  );
  assert.deepEqual(
    exmailHit.matched.map((p) => p.id),
    ["tencent_exmail"],
  );

  const aliyunHit = filterPickerDirectory(
    ALL_PROVIDER_PRESETS,
    "enterprise",
    "aliyun",
  );
  assert.deepEqual(
    aliyunHit.matched.map((p) => p.id),
    ["aliyun_exmail"],
  );

  const larkHit = filterPickerDirectory(
    ALL_PROVIDER_PRESETS,
    "enterprise",
    "feishu",
  );
  assert.deepEqual(
    larkHit.matched.map((p) => p.id),
    ["feishu"],
  );

  const emptyHit = filterPickerDirectory(
    ALL_PROVIDER_PRESETS,
    "all",
    "non-existent-provider-xyz",
  );
  assert.equal(emptyHit.matched.length, 0);
  assert.equal(emptyHit.hasQuery, true);
  assert.equal(emptyHit.showCustomBalanceCard, false);
});

test("点击服务商跳转目标模态框与 980×760 零跳动样式门禁", () => {
  const byId = Object.fromEntries(ALL_PROVIDER_PRESETS.map((p) => [p.id, p]));
  assert.deepEqual(resolveProviderTargetOverlay(byId.workbuddy), {
    type: "workbuddy-connect",
  });
  assert.deepEqual(resolveProviderTargetOverlay(byId.gmail), {
    type: "oauth-flow",
    provider: "gmail",
    stage: "waiting",
  });
  assert.deepEqual(resolveProviderTargetOverlay(byId.tencent_exmail), {
    type: "provider-guide",
    provider: "tencent_exmail",
  });

  assert.equal(isConnectSuiteOverlay({ type: "add-account" }), true);
  assert.equal(isConnectSuiteOverlay({ type: "manual-imap" }), true);
  assert.equal(
    resolveConnectSuiteStageKey({ type: "provider-guide", provider: "qq" }),
    "provider-guide:qq",
  );
  assert.equal(zhCN.onboarding.pickerCatStandard, "个人与常规");
  assert.equal(zhCN.onboarding.pickerCatEnterprise, "企业邮箱");
  assert.equal(enUS.onboarding.pickerCatEnterprise, "Enterprise Mail");

  const modalSrc = readFileSync(
    path.join(rootDir, "src/components/onboarding/AddAccountModal.tsx"),
    "utf8",
  );
  const sideSrc = readFileSync(
    path.join(rootDir, "src/components/onboarding/AddAccountSidebar.tsx"),
    "utf8",
  );
  assert.match(modalSrc, /pcm-modal-card/);
  assert.match(sideSrc, /onOpenManualImap/);
  assert.doesNotMatch(modalSrc + sideSrc, /实验性|安全边界/);

  const pcmCss = readFileSync(
    path.join(rootDir, "src/styles/provider-connect-modal.css"),
    "utf8",
  );
  const aamCss = readFileSync(
    path.join(rootDir, "src/styles/add-account-modal.css"),
    "utf8",
  );
  assert.match(pcmCss, /height:\s*min\(760px,\s*calc\(100vh\s*-\s*36px\)\)/);
  assert.match(aamCss, /grid-template-columns:\s*228px\s+minmax\(0,\s*1fr\)/);
});
