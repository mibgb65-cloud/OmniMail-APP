import assert from "node:assert/strict";
import test from "node:test";
import {
  canBypassExternalLinkConfirm,
  clearTrustedDomains,
  inspectExternalLink,
  isDomainTrusted,
  listTrustedDomains,
  removeTrustedDomain,
  splitPlainTextLinks,
  trustDomain,
} from "../src/components/mail/reader/externalLinkGuard.ts";

function withMockStorage(fn) {
  const store = new Map();
  const prev = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      store.set(k, String(v));
    },
    removeItem: (k) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
  try {
    fn();
  } finally {
    globalThis.localStorage = prev;
  }
}

test("严格拦截非 http/https 协议与非法 URL", () => {
  for (const bad of [
    "",
    "javascript:alert(1)",
    "JAVASCRIPT:void(0)",
    "data:text/html,<script>alert(1)</script>",
    "file:///C:/Windows/System32/cmd.exe",
    "vbscript:msgbox(1)",
    "mailto:alice@example.com",
    "not a valid url",
  ]) {
    assert.equal(inspectExternalLink(bad), null, `应拒绝 ${bad}`);
  }
});

test("常规 HTTPS 链接与同主域子域名不误报，支持信任白名单", () => {
  const normal = inspectExternalLink(
    "https://GITHUB.COM/omnimail/desktop/releases/tag/v0.1.0",
    { displayText: "查看发版说明" },
  );
  assert.ok(normal);
  assert.equal(normal.hostname, "github.com");
  assert.equal(normal.protocol, "https:");
  assert.equal(normal.risk, "normal");
  assert.deepEqual(normal.reasons, []);
  assert.equal(normal.canTrust, true);

  const samePrimary = inspectExternalLink("https://docs.github.com/zh", {
    displayText: "https://github.com/docs",
  });
  assert.equal(samePrimary?.risk, "normal");

  const multiPartTld = inspectExternalLink("https://mail.corp.co.uk/inbox", {
    displayText: "portal.corp.co.uk/login",
  });
  assert.equal(multiPartTld?.risk, "normal");

  const fileLabel = inspectExternalLink("https://files.example.com/a", {
    displayText: "Q4-report.pdf",
  });
  assert.equal(fileLabel?.risk, "normal");
});

test("文本域名伪装、Punycode、高危钓鱼邮件、IP 直连与非加密 HTTP 准确分级", () => {
  const spoofed = inspectExternalLink(
    "http://paypa1-verify-mail.example/auth?u=alex",
    { displayText: "https://paypal.com/security/verify" },
  );
  assert.ok(spoofed);
  assert.equal(spoofed.risk, "danger");
  assert.equal(spoofed.canTrust, false);
  assert.ok(spoofed.reasons.includes("spoofed-text"));
  assert.ok(spoofed.reasons.includes("insecure-http"));

  const bareSpoofed = inspectExternalLink("https://evil.co.uk/phish", {
    displayText: "login.bank.co.uk/verify",
  });
  assert.equal(bareSpoofed?.risk, "danger");
  assert.ok(bareSpoofed?.reasons.includes("spoofed-text"));

  const puny = inspectExternalLink("https://xn--pypal-4ve.com/login", {
    displayText: "安全登录",
  });
  assert.equal(puny?.risk, "danger");
  assert.equal(puny?.canTrust, false);
  assert.ok(puny?.reasons.includes("punycode"));

  const mailDanger = inspectExternalLink("https://github.com/omnimail", {
    mailDanger: true,
  });
  assert.equal(mailDanger?.risk, "danger");
  assert.equal(mailDanger?.canTrust, false);
  assert.ok(mailDanger?.reasons.includes("mail-danger"));

  const httpOnly = inspectExternalLink("http://example.com/news");
  assert.equal(httpOnly?.risk, "warning");
  assert.equal(httpOnly?.canTrust, false);
  assert.deepEqual(httpOnly?.reasons, ["insecure-http"]);

  const ipDirect = inspectExternalLink("https://192.168.1.10:8443/admin");
  assert.equal(ipDirect?.risk, "warning");
  assert.equal(ipDirect?.canTrust, false);
  assert.deepEqual(ipDirect?.reasons, ["ip-address"]);
});

test("受信任域名按 Profile 隔离，且高危或非加密链接无视白名单强制拦截", () => {
  withMockStorage(() => {
    trustDomain("profile-work", "GitHub.com");
    assert.equal(isDomainTrusted("profile-work", "github.com"), true);
    assert.equal(isDomainTrusted("profile-personal", "github.com"), false);
    assert.deepEqual(listTrustedDomains("profile-work"), ["github.com"]);

    const normal = inspectExternalLink("https://github.com/omnimail");
    assert.ok(normal);
    assert.equal(canBypassExternalLinkConfirm(normal, "profile-work"), true);
    assert.equal(
      canBypassExternalLinkConfirm(normal, "profile-personal"),
      false,
    );

    // 安全红线：即便已信任 github.com，高危邮件 / 伪装文本 / 非加密 HTTP 仍强制拦截
    const inPhishingMail = inspectExternalLink("https://github.com/omnimail", {
      mailDanger: true,
    });
    assert.equal(
      canBypassExternalLinkConfirm(inPhishingMail, "profile-work"),
      false,
    );

    const httpGithub = inspectExternalLink("http://github.com/omnimail");
    assert.equal(
      canBypassExternalLinkConfirm(httpGithub, "profile-work"),
      false,
    );

    const spoofToGithub = inspectExternalLink("https://github.com/omnimail", {
      displayText: "https://paypal.com/verify",
    });
    assert.equal(
      canBypassExternalLinkConfirm(spoofToGithub, "profile-work"),
      false,
    );

    // 拒绝将 IP 或 Punycode 写入白名单
    trustDomain("profile-work", "192.168.1.1");
    trustDomain("profile-work", "xn--pypal-4ve.com");
    assert.deepEqual(listTrustedDomains("profile-work"), ["github.com"]);

    removeTrustedDomain("profile-work", "github.com");
    assert.equal(isDomainTrusted("profile-work", "github.com"), false);

    trustDomain("profile-work", "github.com");
    trustDomain("profile-work", "docs.omnimail.dev");
    assert.equal(listTrustedDomains("profile-work").length, 2);
    clearTrustedDomains("profile-work");
    assert.deepEqual(listTrustedDomains("profile-work"), []);
  });
});

test("splitPlainTextLinks 正确切分纯文本 URL 并剥离末尾标点", () => {
  const segs = splitPlainTextLinks(
    "请访问 https://github.com/omnimail/app，或查看 http://example.com/doc。",
  );
  assert.deepEqual(segs, [
    { type: "text", value: "请访问 " },
    { type: "link", value: "https://github.com/omnimail/app" },
    { type: "text", value: "，或查看 " },
    { type: "link", value: "http://example.com/doc" },
    { type: "text", value: "。" },
  ]);
});
