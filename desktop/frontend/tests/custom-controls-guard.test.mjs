import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { computePopoverGeometry } from "../src/components/common/popoverPosition.ts";
import {
  hasOpenNestedSelect,
  isTranslationPopoverLayerEvent,
  TRANSLATION_INITIAL_FOCUS_SELECTOR,
} from "../src/components/mail/translation/useTranslationAnchor.ts";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const srcDir = path.join(rootDir, "src");

function collectSourceFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

test("全仓前端源码零原生 <select>、<option>、checkbox 与 radio 控件", () => {
  const allowedWrappers = new Set([
    path.normalize("src/components/common/Checkbox.tsx"),
    path.normalize("src/components/common/CustomSelect.tsx"),
    path.normalize("src/components/common/CustomSelectPopover.tsx"),
    path.normalize("src/components/common/CustomSelectOptionList.tsx"),
  ]);
  const forbidden =
    /<select\b|<option\b|type\s*=\s*["'](?:checkbox|radio)["']/g;

  for (const file of collectSourceFiles(srcDir)) {
    const rel = path.relative(rootDir, file);
    if (allowedWrappers.has(rel)) continue;
    const content = readFileSync(file, "utf8");
    const matches = content.match(forbidden);
    assert.equal(
      matches,
      null,
      `${rel} 不允许出现原生下拉或单复选框: ${matches?.join(", ")}`,
    );
  }
});

test("TranslationPopover 初始聚焦、嵌套 Portal 防误关与双层 Esc 收起判据", () => {
  assert.equal(
    TRANSLATION_INITIAL_FOCUS_SELECTOR,
    'button[role="combobox"], button, input',
  );

  const panel = {};
  const trigger = {};
  const outside = {};
  const selectPortal = {
    matches: (selector) =>
      selector.includes('[data-omnimail-popover="select"]'),
  };
  const listboxNode = {
    matches: (selector) => selector.includes('[role="listbox"]'),
  };

  assert.equal(isTranslationPopoverLayerEvent([panel], panel, trigger), true);
  assert.equal(isTranslationPopoverLayerEvent([trigger], panel, trigger), true);
  assert.equal(
    isTranslationPopoverLayerEvent([outside, selectPortal], panel, trigger),
    true,
  );
  assert.equal(
    isTranslationPopoverLayerEvent([outside, listboxNode], panel, trigger),
    true,
  );
  assert.equal(
    isTranslationPopoverLayerEvent([outside], panel, trigger),
    false,
  );

  const closedPanel = { querySelector: () => null };
  const closedDoc = { querySelector: () => null };
  assert.equal(hasOpenNestedSelect(closedPanel, closedDoc), false);

  const expandedTriggerPanel = {
    querySelector: (sel) =>
      sel === '[role="combobox"][aria-expanded="true"]' ? {} : null,
  };
  assert.equal(hasOpenNestedSelect(expandedTriggerPanel, closedDoc), true);

  const openPortalDoc = {
    querySelector: (sel) =>
      sel === '[data-omnimail-popover="select"]:not([data-closing="true"])'
        ? {}
        : null,
  };
  assert.equal(hasOpenNestedSelect(closedPanel, openPortalDoc), true);
});

test("computePopoverGeometry 在右侧与底部边界自动收敛并翻转，且层级高于气泡", () => {
  const prevWindow = globalThis.window;
  globalThis.window = { innerWidth: 420, innerHeight: 500 };
  try {
    const rightBottomTrigger = {
      getBoundingClientRect: () => ({
        left: 310,
        top: 390,
        bottom: 420,
        width: 96,
      }),
      closest: () => null,
    };
    const flipped = computePopoverGeometry(rightBottomTrigger, 220, 176);
    assert.equal(flipped.side, "top");
    assert.equal(flipped.width, 176);
    assert.equal(flipped.left, 234);
    assert.equal(flipped.bottom, 116);
    assert.ok(flipped.maxHeight >= 120 && flipped.maxHeight <= 260);

    const shortViewportTrigger = {
      getBoundingClientRect: () => ({
        left: 24,
        top: 250,
        bottom: 280,
        width: 140,
      }),
      closest: () => null,
    };
    const constrained = computePopoverGeometry(shortViewportTrigger, 260, 176);
    assert.equal(constrained.side, "top");
    assert.equal(constrained.maxHeight, 234);
  } finally {
    globalThis.window = prevWindow;
  }

  const customControlsCss = readFileSync(
    path.join(srcDir, "styles", "custom-controls.css"),
    "utf8",
  );
  const translationCss = readFileSync(
    path.join(srcDir, "styles", "mail-translation.css"),
    "utf8",
  );
  const selectZ = Number(
    customControlsCss.match(
      /\.custom-select-menu\s*\{[^}]*z-index:\s*(\d+)/s,
    )?.[1],
  );
  const popoverZ = Number(
    translationCss.match(
      /\.translation-popover\s*\{[^}]*z-index:\s*(\d+)/s,
    )?.[1],
  );
  assert.ok(
    selectZ > popoverZ,
    `期望下拉层级(${selectZ})高于翻译气泡(${popoverZ})`,
  );
});
