import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getReaderToolbarLayout,
  getReaderToolbarRequiredWidth,
} from "../src/components/mail/reader/readerToolbarLayout.ts";
import {
  enUS,
  formatLocalizedTime,
  localizeSecurityWarning,
  plural,
  setCurrentLanguage,
  t,
  zhCN,
} from "../src/i18n/index.ts";
import { parseBackendError } from "../src/services/errorParser.ts";

function extractPlaceholders(str) {
  const names = new Set();
  for (const m of str.matchAll(/\{(\w+)(?:,\s*plural,[\s\S]*?)?\}/g)) {
    names.add(m[1]);
  }
  return [...names].sort();
}

test("zhCN 与 enUS 词典键集合、非空文本及模板占位符 100% 对齐", () => {
  const zhDomains = Object.keys(zhCN).sort();
  const enDomains = Object.keys(enUS).sort();
  assert.deepEqual(enDomains, zhDomains);

  for (const domain of zhDomains) {
    const zhBucket = zhCN[domain];
    const enBucket = enUS[domain];
    const zhKeys = Object.keys(zhBucket).sort();
    const enKeys = Object.keys(enBucket).sort();
    assert.deepEqual(enKeys, zhKeys, `domain ${domain} keys mismatch`);

    for (const key of zhKeys) {
      assert.equal(typeof zhBucket[key], "string", `zhCN.${domain}.${key}`);
      assert.equal(typeof enBucket[key], "string", `enUS.${domain}.${key}`);
      if (key !== "foreignScopeTitleSuffix") {
        assert.ok(zhBucket[key].length > 0, `zhCN.${domain}.${key} empty`);
        assert.ok(enBucket[key].length > 0, `enUS.${domain}.${key} empty`);
      }
      assert.deepEqual(
        extractPlaceholders(enBucket[key]),
        extractPlaceholders(zhBucket[key]),
        `placeholder mismatch at ${domain}.${key}`,
      );
    }
  }
});

test("全局统一英文术语表与翻译品牌边界严格符合设计稿规范", () => {
  assert.equal(enUS.sidebar.compose, "Compose");
  assert.equal(enUS.sidebar.unifiedInbox, "Unified Inbox");
  assert.equal(enUS.sidebar.addAccountBtn, "Add");
  assert.equal(
    enUS.topbar.searchMailPlaceholder,
    "Search accounts, contacts, subjects, or attachments…",
  );

  // 列表筛选短词防折行：使用 Files 而非冗长 Attachments
  assert.equal(enUS.mailList.tabAll, "All");
  assert.equal(enUS.mailList.tabUnread, "Unread");
  assert.equal(enUS.mailList.tabStarred, "Starred");
  assert.equal(enUS.mailList.tabFiles, "Files");
  assert.equal(enUS.mailList.todayNewestFirst, "Today · Newest first");
  assert.equal(enUS.common.backToTop, "Back to top");
  assert.equal(enUS.mailList.aiSummaryBadge, "AI Summary");

  // 读信主界面严禁出现 Bilibili 第三方品牌，设置页允许展示
  for (const [k, val] of Object.entries(enUS.translation)) {
    assert.doesNotMatch(val, /bilibili/i, `enUS.translation.${k} leaked brand`);
  }
  for (const [k, val] of Object.entries(zhCN.translation)) {
    assert.doesNotMatch(
      val,
      /bilibili|哔哩/i,
      `zhCN.translation.${k} leaked brand`,
    );
  }
  assert.equal(enUS.translation.builtInFreeEngine, "Built-in free engine");
  assert.equal(enUS.translation.aiModel, "AI model");
  assert.equal(
    enUS.settings.transBilibiliFreeOption,
    "Bilibili Free Translate (Recommended)",
  );
  assert.equal(enUS.settings.transAiByokOption, "AI Assistant Model (BYOK)");

  // Omni AI、安全警示横幅与设置 12 页签术语校验
  assert.equal(enUS.ai.emailSummary, "Email Summary");
  assert.equal(enUS.ai.keyDatesAndTasks, "Key Dates & Tasks");
  assert.equal(enUS.ai.smartReplyDraft, "Smart Reply Draft");
  assert.equal(enUS.settings.aiModeOnDemand, "On demand");
  assert.equal(enUS.settings.aiModeAutoSummarize, "Auto-summarize on open");
  assert.equal(enUS.settings.aiModeDisabled, "Disabled");
  assert.equal(enUS.security.highRiskWarning, "High-risk phishing warning");
  assert.equal(enUS.security.verifySenderLinks, "Verify sender & links");
  assert.equal(enUS.security.trustSender, "Trust this sender");
  assert.deepEqual(
    [
      enUS.settings.navGeneral,
      enUS.settings.navAccounts,
      enUS.settings.navSync,
      enUS.settings.navCompose,
      enUS.settings.navAi,
      enUS.settings.navTranslation,
      enUS.settings.navRules,
      enUS.settings.navAutoReply,
      enUS.settings.navPrivacy,
      enUS.settings.navStorage,
      enUS.settings.navShortcuts,
      enUS.settings.navAbout,
    ],
    [
      "General",
      "Accounts",
      "Sync & Offline",
      "Compose & Signatures",
      "AI Assistant",
      "Mail Translation",
      "Rules",
      "Auto-Reply",
      "Privacy & Security",
      "Storage & Migration",
      "Shortcuts",
      "About",
    ],
  );
});

test("日期格式化、单复数、后端错误码与安全告警双语切换正常", () => {
  assert.equal(formatLocalizedTime("11月15日 10:42", "en-US"), "Nov 15, 10:42");
  assert.equal(formatLocalizedTime("昨天", "en-US"), "Yesterday");
  assert.equal(formatLocalizedTime("今天", "en-US"), "Today");
  assert.equal(plural("en-US", 1, "file"), "1 file");
  assert.equal(plural("en-US", 4, "account"), "4 accounts");

  const localizedWarn = localizeSecurityWarning(
    {
      level: "danger",
      title: "高危钓鱼或欺诈邮件预警",
      detail:
        "发件域身份认证未通过（DMARC/SPF+DKIM 校验失败），极可能为伪造发件人；正文链接显示为 login.paypal.com，实际指向可疑域名 evil-paypa1.ru。",
      spf: "fail",
      dkim: "fail",
      dmarc: "fail",
    },
    "en-US",
  );
  assert.equal(localizedWarn.title, "High-risk phishing warning");
  assert.doesNotMatch(localizedWarn.detail, /[\u4e00-\u9fff]/);

  setCurrentLanguage("en-US");
  try {
    assert.equal(t("mailList.newEmailsPill", { count: 3 }), "3 new emails");
    const aiErr = parseBackendError(
      new Error("ERR_AI_CONSENT_REQUIRED: 需先确认"),
    );
    assert.equal(aiErr.code, "ERR_AI_CONSENT_REQUIRED");
    assert.doesNotMatch(aiErr.message, /[\u4e00-\u9fff]/);
  } finally {
    setCurrentLanguage("zh-CN");
  }
});

test("英文读信工具栏在 1440px/1728px 完整展示且窄屏逐级折叠不溢出", () => {
  const desktop1440 = getReaderToolbarLayout(856, "en-US");
  assert.deepEqual(desktop1440.actions, [
    "reply",
    "forward",
    "archive",
    "snooze",
    "label",
  ]);
  assert.equal(desktop1440.showCount, true);
  assert.equal(desktop1440.aiLabel, "full");

  for (let width = 200; width <= 960; width += 2) {
    const layout = getReaderToolbarLayout(width, "en-US");
    assert.ok(getReaderToolbarRequiredWidth(layout, "en-US") <= width);
  }
});
