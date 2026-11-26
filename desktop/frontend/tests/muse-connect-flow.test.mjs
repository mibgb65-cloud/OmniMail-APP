import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  MUSE_DEFAULT_ACCOUNT_NAME,
  MUSE_LOGIN_POLL_INTERVAL_MS,
  resolveInitialMuseAccountName,
  shouldPollMuseLoginSession,
} from "../src/components/onboarding/museConnectPolling.ts";
import { setCurrentLanguage } from "../src/i18n/index.ts";
import { parseBackendError } from "../src/services/errorParser.ts";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("MuseConnectModal 自动会话就绪轮询守卫、防死循环与默认账户名回填", () => {
  assert.equal(MUSE_LOGIN_POLL_INTERVAL_MS, 1500);
  assert.equal(resolveInitialMuseAccountName(""), MUSE_DEFAULT_ACCOUNT_NAME);
  assert.equal(resolveInitialMuseAccountName("   "), "Muse");
  assert.equal(resolveInitialMuseAccountName("Muse 工作箱"), "Muse 工作箱");

  assert.equal(
    shouldPollMuseLoginSession({
      loginStage: "login_open",
      verifiedEmail: "",
      openingLogin: false,
      busy: false,
      autoVerifyTried: false,
      aborted: false,
    }),
    true,
  );
  // 已尝试过自动验证（即便失败）立即停止自动轮询，防止死循环
  assert.equal(
    shouldPollMuseLoginSession({
      loginStage: "login_open",
      verifiedEmail: "",
      openingLogin: false,
      busy: false,
      autoVerifyTried: true,
      aborted: false,
    }),
    false,
  );
  // 验证中、手动中止或已获得验证邮箱时停止轮询
  assert.equal(
    shouldPollMuseLoginSession({
      loginStage: "login_open",
      verifiedEmail: "",
      openingLogin: false,
      busy: true,
      autoVerifyTried: false,
      aborted: false,
    }),
    false,
  );
  assert.equal(
    shouldPollMuseLoginSession({
      loginStage: "login_open",
      verifiedEmail: "",
      openingLogin: false,
      busy: false,
      autoVerifyTried: false,
      aborted: true,
    }),
    false,
  );
  assert.equal(
    shouldPollMuseLoginSession({
      loginStage: "verified",
      verifiedEmail: "alice@muse.ai",
      openingLogin: false,
      busy: false,
      autoVerifyTried: false,
      aborted: false,
    }),
    false,
  );

  // 校验组件卸载清理定时器逻辑存在
  const hookSrc = readFileSync(
    path.join(
      rootDir,
      "src",
      "components",
      "onboarding",
      "useMuseLoginAutoFlow.ts",
    ),
    "utf8",
  );
  assert.match(hookSrc, /window\.clearInterval\(timer\)/);
  assert.match(hookSrc, /checkLoginSessionReady/);
});

test("Muse 网关阶段脱敏诊断信息在中英双语下保留阶段标签与状态码", () => {
  const zhParsed = parseBackendError(
    new Error(
      "[ERR_MUSE_GATEWAY_FAILED] [ws_dial] Muse 网关握手建连失败（HTTP 502）",
    ),
  );
  assert.equal(zhParsed.code, "ERR_MUSE_GATEWAY_FAILED");
  assert.match(zhParsed.message, /^\[ws_dial\]/);
  assert.match(zhParsed.message, /HTTP 502/);

  setCurrentLanguage("en-US");
  try {
    const enParsed = parseBackendError(
      new Error(
        "[ERR_MUSE_GATEWAY_FAILED] [ws_dial] Muse 网关握手建连失败（HTTP 502）",
      ),
    );
    assert.equal(enParsed.code, "ERR_MUSE_GATEWAY_FAILED");
    assert.match(enParsed.message, /^\[ws_dial\]/);
    assert.match(enParsed.message, /HTTP 502/);
    assert.doesNotMatch(enParsed.message, /[\u4e00-\u9fff]/);
  } finally {
    setCurrentLanguage("zh-CN");
  }
});
