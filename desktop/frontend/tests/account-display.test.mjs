import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveAccountName } from "../src/components/onboarding/providerConnectHelpers.ts";
import {
  ACCOUNT_NAME_MAX_LEN,
  buildAccountNameSuggestions,
  CONCISE_PROVIDER_LABELS,
  resolveConciseProviderLabel,
  resolveSidebarAccountTitle,
} from "../src/utils/accountDisplay.ts";

test("所有个人与企业邮箱精简名均不含 邮箱 / Mail / 邮件 冗余后缀", () => {
  const personalAndEnterpriseIds = [
    "gmail",
    "outlook",
    "qq",
    "netease",
    "linuxdo",
    "icloud",
    "yahoo",
    "nevermail",
    "yandex",
    "tencent_exmail",
    "aliyun_exmail",
    "netease_exmail",
    "feishu",
    "mail263",
    "zoho_exmail",
  ];

  for (const id of personalAndEnterpriseIds) {
    const zhLabel = resolveConciseProviderLabel(
      id,
      "user@example.com",
      "zh-CN",
    );
    assert.ok(zhLabel.length > 0, `${id} zh concise label empty`);
    assert.doesNotMatch(
      zhLabel,
      /邮箱|邮件|\bMail\b/i,
      `${id} zh label "${zhLabel}" contains redundant suffix`,
    );
  }

  for (const id of [
    "gmail",
    "outlook",
    "qq",
    "netease",
    "linuxdo",
    "icloud",
    "yahoo",
    "nevermail",
    "yandex",
  ]) {
    const enLabel = CONCISE_PROVIDER_LABELS[id].en;
    assert.doesNotMatch(
      enLabel,
      /\bMail\b/i,
      `${id} en label "${enLabel}" contains redundant Mail suffix`,
    );
  }

  assert.equal(
    resolveConciseProviderLabel("imap", "xiarui@ganlion.cc", "zh-CN"),
    "ganlion.cc",
  );
});

test("旧自动拼接名精准折叠为精简品牌名或域名，用户自定义名称原样保留", () => {
  assert.equal(
    resolveSidebarAccountTitle({
      name: "QQ 邮箱 · 1915992742",
      provider: "qq",
      email: "1915992742@qq.com",
    }),
    "QQ",
  );
  assert.equal(
    resolveSidebarAccountTitle({
      name: "网易邮箱 · cdutspringboot",
      provider: "netease",
      email: "cdutspringboot@163.com",
    }),
    "网易",
  );
  assert.equal(
    resolveSidebarAccountTitle({
      name: "iCloud Mail · mimanchi",
      provider: "icloud",
      email: "mimanchi@icloud.com",
    }),
    "iCloud",
  );
  assert.equal(
    resolveSidebarAccountTitle({
      name: "iCloud 邮件 · mimanchi",
      provider: "icloud",
      email: "mimanchi@icloud.com",
    }),
    "iCloud",
  );
  assert.equal(
    resolveSidebarAccountTitle({
      name: "标准 IMAP / SMTP · xiarui",
      provider: "imap",
      email: "xiarui@ganlion.cc",
    }),
    "ganlion.cc",
  );
  assert.equal(
    resolveSidebarAccountTitle({
      name: "通用 IMAP / SMTP",
      provider: "imap",
      email: "xiarui@ganlion.cc",
    }),
    "ganlion.cc",
  );

  for (const custom of [
    "腾讯企业邮",
    "公司工作邮",
    "夏锐的主力箱",
    "研发部 · 告警收件箱",
  ]) {
    assert.equal(
      resolveSidebarAccountTitle({
        name: custom,
        provider: "imap",
        email: "xiarui@ganlion.cc",
      }),
      custom,
    );
  }
});

test("resolveAccountName 与快捷命名推荐标签符合 24 字符上限且不拼接 · prefix", () => {
  assert.equal(
    resolveAccountName("  公司工作邮  ", "qq", "a@qq.com"),
    "公司工作邮",
  );
  assert.equal(resolveAccountName("   ", "QQ 邮箱", "xinghe@qq.com"), "QQ");
  assert.equal(
    resolveAccountName("", "imap", "xiarui@ganlion.cc"),
    "ganlion.cc",
  );

  const overlong = "这是一个超过二十四个字符的超级长自定义邮箱账户显示名称测试";
  assert.equal(
    resolveAccountName(overlong, "qq", "a@qq.com").length,
    ACCOUNT_NAME_MAX_LEN,
  );

  const chips = buildAccountNameSuggestions(
    "tencent_exmail",
    "xiarui@ganlion.cc",
    "zh-CN",
  );
  assert.ok(chips.includes("腾讯企业邮"));
  assert.ok(chips.includes("公司工作邮"));
  assert.ok(chips.length >= 3 && chips.length <= 4);
});
