import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  authStatusPillClass,
  clearTrustedSecuritySenders,
  formatAuthBadgeValue,
  isTrustedSecuritySender,
  rememberTrustedSecuritySender,
} from "../src/components/mail/reader/securityBannerPolicy.ts";

test("SPF/DKIM/DMARC 胶囊按真实认证结果独立分色，绝不将 pass 染红", () => {
  assert.equal(authStatusPillClass("pass"), "pill-success");
  assert.equal(authStatusPillClass("PASS "), "pill-success");
  assert.equal(authStatusPillClass("fail"), "pill-danger");
  assert.equal(authStatusPillClass("FAIL"), "pill-danger");
  assert.equal(authStatusPillClass("permerror"), "pill-danger");
  assert.equal(authStatusPillClass("softfail"), "pill-warning");
  assert.equal(authStatusPillClass("temperror"), "pill-warning");
  assert.equal(authStatusPillClass("unknown"), "pill-neutral");
  assert.equal(authStatusPillClass("none"), "pill-neutral");
  assert.equal(authStatusPillClass("neutral"), "pill-neutral");
  assert.equal(authStatusPillClass(""), "pill-neutral");

  assert.equal(formatAuthBadgeValue(" PASS "), "pass");
  assert.equal(formatAuthBadgeValue(""), "unknown");
});

test("信任发件人状态按本地空间隔离，支持同发件人收起安全横幅", () => {
  clearTrustedSecuritySenders();
  assert.equal(
    isTrustedSecuritySender("profile-a", "Alert@Partner.com", "mail-1"),
    false,
  );

  rememberTrustedSecuritySender("profile-a", "Alert@Partner.com", "mail-1");
  assert.equal(
    isTrustedSecuritySender("profile-a", "alert@partner.com", "mail-2"),
    true,
  );
  assert.equal(
    isTrustedSecuritySender("profile-b", "alert@partner.com", "mail-2"),
    false,
  );

  rememberTrustedSecuritySender("profile-a", "", "mail-no-sender");
  assert.equal(
    isTrustedSecuritySender("profile-a", "", "mail-no-sender"),
    true,
  );
  assert.equal(isTrustedSecuritySender("profile-a", "", "mail-other"), false);
  clearTrustedSecuritySenders();
});

test("安全警示横幅采用三段式横向结构与亮暗分色样式，无硬编码 danger 或竖排按钮列", () => {
  const srcDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src",
  );
  const tsx = readFileSync(
    path.join(srcDir, "components/mail/reader/ReaderSecurityBanners.tsx"),
    "utf8",
  );
  const css = readFileSync(
    path.join(srcDir, "styles/mail-security-banner.css"),
    "utf8",
  );

  assert.doesNotMatch(tsx, /className="security-banner danger"[\s\S]*SPF:/);
  assert.doesNotMatch(tsx, /flexDirection:\s*"column"/);
  assert.match(
    tsx,
    /className=\{`phishing-banner \$\{isDanger \? "danger" : "warning"\}`\}/,
  );
  assert.match(tsx, /security\.trustSender/);
  assert.match(css, /\.phishing-banner\.danger\s*\{[^}]*#fef2f2[^}]*#fecaca/is);
  assert.match(
    css,
    /:root\[data-theme="dark"\]\s*\.phishing-banner\.danger\s*\{[^}]*#3b1820[^}]*#7f1d1d/is,
  );
  assert.match(
    css,
    /\.phishing-trust-btn\s*\{[^}]*margin-inline-start:\s*auto/s,
  );
});
