import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AdjustmentsVerticalIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  Cog6ToothIcon,
  DocumentIcon,
  DocumentTextIcon,
  PencilIcon,
  PencilSquareIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  SparklesIcon,
  StopIcon,
} from "@heroicons/react/24/outline";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { appIcons } from "../src/components/common/iconRegistry.ts";

test("所有 UI 图标均输出 24×24、1.5 描边和无填充的官方轮廓", () => {
  for (const [name, glyph] of Object.entries(appIcons)) {
    const html = renderToStaticMarkup(createElement(glyph));
    assert.match(html, /viewBox="0 0 24 24"/, name);
    assert.match(html, /stroke-width="1\.5"/, name);
    assert.match(html, /stroke="currentColor"/, name);
    assert.match(html, /fill="none"/, name);
    assert.match(html, /aria-hidden="true"/, name);
  }
});

test("首页与设置使用设计稿中对应的变体", () => {
  const expected = {
    settings: Cog6ToothIcon,
    sliders: AdjustmentsVerticalIcon,
    pen: PencilSquareIcon,
    pencil: PencilIcon,
    reply: ArrowUturnLeftIcon,
    forward: ArrowUturnRightIcon,
    documentText: DocumentTextIcon,
    file: DocumentIcon,
    sparkle: SparklesIcon,
    shield: ShieldCheckIcon,
    shieldWarning: ShieldExclamationIcon,
    square: StopIcon,
  };
  for (const [name, glyph] of Object.entries(expected)) {
    assert.equal(appIcons[name], glyph, name);
  }
});
