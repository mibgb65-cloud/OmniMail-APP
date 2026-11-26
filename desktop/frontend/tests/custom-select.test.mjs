import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  resolveCustomSelectTriggerMeta,
  resolveSidebarAccountTitle,
} from "../src/utils/accountDisplay.ts";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("CustomSelect 收起态副标题：showSublabelInTrigger=true 时展示主名称与邮箱，默认 false 时仅展示 label", () => {
  const qqOpt = {
    label: resolveSidebarAccountTitle(
      {
        name: "QQ 邮箱 · 1915992742",
        provider: "qq",
        email: "1915992742@qq.com",
      },
      "zh-CN",
    ),
    sublabel: "1915992742@qq.com",
  };
  assert.equal(qqOpt.label, "QQ");

  const withSub = resolveCustomSelectTriggerMeta(qqOpt, true);
  assert.equal(withSub.label, "QQ");
  assert.equal(withSub.inlineSublabel, "1915992742@qq.com");
  assert.equal(withSub.title, "QQ · 1915992742@qq.com");

  const defaultNoSub = resolveCustomSelectTriggerMeta(qqOpt, false);
  assert.equal(defaultNoSub.label, "QQ");
  assert.equal(defaultNoSub.inlineSublabel, null);
  assert.equal(defaultNoSub.title, "QQ · 1915992742@qq.com");

  // 当 sublabel 与 label 完全相同时（例如通用 IMAP 极端配置），不重复渲染第二段
  const duplicateOpt = {
    label: "team@example.com",
    sublabel: "team@example.com",
  };
  const deduped = resolveCustomSelectTriggerMeta(duplicateOpt, true);
  assert.equal(deduped.inlineSublabel, null);
  assert.equal(deduped.title, "team@example.com");
});

test("CustomSelect 无 sublabel 选项（如「全部账户」）不会渲染多余 · 分隔符", () => {
  const allAccountsOpt = { label: "全部账户" };
  const meta = resolveCustomSelectTriggerMeta(allAccountsOpt, true);
  assert.equal(meta.label, "全部账户");
  assert.equal(meta.inlineSublabel, null);
  assert.equal(meta.title, "全部账户");

  const emptySubOpt = { label: "所有已连接邮箱（3）", sublabel: "   " };
  const metaBlank = resolveCustomSelectTriggerMeta(emptySubOpt, true);
  assert.equal(metaBlank.inlineSublabel, null);
  assert.equal(metaBlank.title, "所有已连接邮箱（3）");

  const selectSrc = readFileSync(
    path.join(rootDir, "src", "components", "common", "CustomSelect.tsx"),
    "utf8",
  );
  assert.match(selectSrc, /triggerMeta\.inlineSublabel \?/);
  assert.match(selectSrc, /custom-select-trigger-label/);
  assert.match(selectSrc, /custom-select-trigger-sublabel/);
});

test("全站 5 处邮箱账户下拉选择器统一接入 showSublabelInTrigger 与 resolveSidebarAccountTitle", () => {
  const targets = [
    "src/components/compose/ComposeHeaderFields.tsx",
    "src/components/settings/ComposeTab.tsx",
    "src/components/settings/AutoReplyTab.tsx",
    "src/components/overlays/AdvancedSearchModal.tsx",
    "src/components/overlays/RuleEditorModal.tsx",
  ];

  for (const rel of targets) {
    const src = readFileSync(path.join(rootDir, rel), "utf8");
    assert.match(
      src,
      /showSublabelInTrigger/,
      `${rel} 应开启 showSublabelInTrigger`,
    );
    assert.match(
      src,
      /resolveSidebarAccountTitle\(acc,\s*lang\)/,
      `${rel} 应统一使用 resolveSidebarAccountTitle(acc, lang)`,
    );
    assert.doesNotMatch(
      src,
      /label:\s*acc\.name\b/,
      `${rel} 不应再残留旧的 label: acc.name`,
    );
  }

  const composeHeaderSrc = readFileSync(
    path.join(rootDir, "src/components/compose/ComposeHeaderFields.tsx"),
    "utf8",
  );
  assert.match(composeHeaderSrc, /maxWidth:\s*420/);
  assert.match(composeHeaderSrc, /minMenuWidth=\{300\}/);
});
