import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  resolveAccountName,
  resolveSecretLabelKey,
} from "../src/components/onboarding/providerConnectHelpers.ts";
import {
  findProviderCatalogItem,
  PROVIDER_CATALOG,
} from "../src/data/providers.ts";
import { enUS, localizeProviderPreset, zhCN } from "../src/i18n/index.ts";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("15 家内置个人与企业服务商均补齐 domainHint、https 官方指引链接与 3 步准备文案", () => {
  const expectedIds = [
    "gmail",
    "outlook",
    "qq",
    "netease",
    "linuxdo",
    "nevermail",
    "yandex",
    "icloud",
    "yahoo",
    "tencent_exmail",
    "aliyun_exmail",
    "netease_exmail",
    "feishu",
    "mail263",
    "zoho_exmail",
  ];
  assert.deepEqual(
    PROVIDER_CATALOG.map((p) => p.id),
    expectedIds,
  );

  for (const item of PROVIDER_CATALOG) {
    assert.ok(item.domainHint.trim().length > 0, `${item.id} domainHint empty`);
    assert.match(
      item.officialGuideUrl,
      /^https:\/\//,
      `${item.id} officialGuideUrl must be https`,
    );
    assert.equal(item.steps.length, 3, `${item.id} must have 3 steps`);

    const enItem = localizeProviderPreset(item, "en-US");
    assert.doesNotMatch(
      enItem.domainHint,
      /[\u4e00-\u9fff]/,
      `${item.id} en domainHint leaked CJK`,
    );
    assert.doesNotMatch(
      enItem.emailPlaceholder ?? "",
      /[\u4e00-\u9fff]/,
      `${item.id} en emailPlaceholder leaked CJK`,
    );
    for (const s of enItem.steps) {
      assert.doesNotMatch(
        s,
        /[\u4e00-\u9fff]/,
        `${item.id} en step leaked CJK`,
      );
    }
  }

  assert.equal(
    findProviderCatalogItem("qq").domainHint,
    "qq.com / foxmail.com",
  );
  assert.equal(
    findProviderCatalogItem("netease").domainHint,
    "163.com / 126.com",
  );
  assert.equal(
    findProviderCatalogItem("tencent_exmail").defaultImapHost,
    "imap.exmail.qq.com",
  );
  assert.equal(
    findProviderCatalogItem("netease_exmail").defaultImapHost,
    "imaphz.qiye.163.com",
  );
});

test("专用凭据标签按个人与企业服务商精准分流，账户名称支持自定义或回退精简品牌名", () => {
  assert.equal(
    zhCN.onboarding[resolveSecretLabelKey("qq").split(".")[1]],
    "客户端授权码",
  );
  assert.equal(
    zhCN.onboarding[resolveSecretLabelKey("netease_exmail").split(".")[1]],
    "客户端授权码",
  );
  assert.equal(
    zhCN.onboarding[resolveSecretLabelKey("tencent_exmail").split(".")[1]],
    "客户端专用密码",
  );
  assert.equal(
    zhCN.onboarding[resolveSecretLabelKey("feishu").split(".")[1]],
    "客户端专用密码",
  );
  assert.equal(
    zhCN.onboarding[resolveSecretLabelKey("aliyun_exmail").split(".")[1]],
    "三方客户端安全密码",
  );
  assert.equal(
    zhCN.onboarding[resolveSecretLabelKey("mail263").split(".")[1]],
    "三方客户端安全密码",
  );
  assert.equal(
    zhCN.onboarding[resolveSecretLabelKey("zoho_exmail").split(".")[1]],
    "App 专用密码",
  );
  assert.equal(
    zhCN.onboarding[resolveSecretLabelKey("linuxdo").split(".")[1]],
    "客户端专用令牌",
  );

  assert.equal(
    resolveAccountName("  工作邮箱  ", "QQ 邮箱", "xinghe@qq.com"),
    "工作邮箱",
  );
  assert.equal(resolveAccountName("   ", "QQ 邮箱", "xinghe@qq.com"), "QQ");
  assert.equal(
    resolveAccountName("", "imap", "xiarui@ganlion.cc"),
    "ganlion.cc",
  );
  assert.equal(enUS.onboarding.localEncryptedPill, "Local encrypted");
});

test("接入弹窗双栏布局与亮暗双色关键设计令牌与窄屏断点齐全", () => {
  const modalCss = readFileSync(
    path.join(rootDir, "src", "styles", "provider-connect-modal.css"),
    "utf8",
  );
  const extrasCss = readFileSync(
    path.join(rootDir, "src", "styles", "provider-connect-extras.css"),
    "utf8",
  );
  assert.match(modalCss, /min\(980px,\s*calc\(100vw\s*-\s*40px\)\)/);
  assert.match(modalCss, /grid-template-columns:\s*336px\s+minmax\(0,\s*1fr\)/);
  assert.match(modalCss, /@media\s*\(max-width:\s*819px\)/);
  assert.match(modalCss, /#131822/);
  assert.match(modalCss, /#333e52/i);
  assert.match(modalCss, /#edf4ff/i);
  assert.match(modalCss, /#1b2842/i);
  assert.match(extrasCss, /min-height:\s*64px/);
});
