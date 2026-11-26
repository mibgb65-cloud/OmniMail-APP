import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  computeUpdatePopoverLayout,
  extractReleaseHighlights,
  formatByteSize,
  formatSpeedBps,
  resolveTopBarUpdateTier,
} from "../src/utils/updateFormat.ts";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("resolveTopBarUpdateTier 覆盖宽屏、笔记本、紧凑与 <860px 极窄四级自适应", () => {
  assert.equal(resolveTopBarUpdateTier(1600), "wide");
  assert.equal(resolveTopBarUpdateTier(1440), "wide");
  assert.equal(resolveTopBarUpdateTier(1280), "laptop");
  assert.equal(resolveTopBarUpdateTier(1025), "laptop");
  assert.equal(resolveTopBarUpdateTier(1024), "compact");
  assert.equal(resolveTopBarUpdateTier(860), "compact");
  assert.equal(resolveTopBarUpdateTier(859), "ultra");
});

test("computeUpdatePopoverLayout 严格钳位视口左右 >= 12px 且保证 960x640 下日志限高", () => {
  const wideLayout = computeUpdatePopoverLayout(
    { top: 10, bottom: 42, left: 1100, right: 1200 },
    1280,
    720,
    false,
  );
  assert.equal(wideLayout.width, 396);
  assert.equal(wideLayout.left, 1200 - 396);
  assert.equal(wideLayout.notesMaxHeight, 220);

  const minWinLayout = computeUpdatePopoverLayout(
    { top: 10, bottom: 42, left: 20, right: 52 },
    960,
    640,
    true,
  );
  assert.equal(minWinLayout.width, 356);
  assert.equal(minWinLayout.left, 12);
  assert.ok(
    minWinLayout.notesMaxHeight <= 340 && minWinLayout.notesMaxHeight <= 220,
  );
});

test("extractReleaseHighlights 提取前 3~5 条干净要点并格式化速度与文件大小", () => {
  const md = `
## v0.0.1.beta.18 更新说明
- **静默自动更新**：支持后台下载、SHA-256 校验与 NSIS 静默重启
- 重构「设置 → 关于 OmniMail」三卡片布局
1. 新增顶栏四档自适应更新胶囊与紧凑悬浮卡
* 清理早期运行态横幅预览卡片
- [查看仓库详情](https://github.com/omnimail-org/omnimail)
- 第六条冗余说明不应超限
`;
  const list = extractReleaseHighlights(md, 5);
  assert.equal(list.length, 5);
  assert.equal(
    list[0],
    "静默自动更新：支持后台下载、SHA-256 校验与 NSIS 静默重启",
  );
  assert.equal(list[4], "查看仓库详情");

  assert.equal(formatByteSize(7_586_923), "7.2 MB");
  assert.equal(formatSpeedBps(4.2 * 1024 * 1024), "4.2 MB/s");
});

test("关于页与设置弹窗已移除运行态横幅预览卡片并接入真实版本号", () => {
  const aboutSrc = readFileSync(
    path.join(rootDir, "src/components/settings/ShortcutsAndAboutTabs.tsx"),
    "utf8",
  );
  const settingsSrc = readFileSync(
    path.join(rootDir, "src/components/settings/SettingsModal.tsx"),
    "utf8",
  );
  const settingsNavSrc = readFileSync(
    path.join(rootDir, "src/components/settings/SettingsSidebarNav.tsx"),
    "utf8",
  );
  assert.doesNotMatch(
    aboutSrc,
    /bannerOptions|aboutBannerPreviewTitle|switchedBannerMode/,
  );
  assert.doesNotMatch(settingsSrc, /"0\.1\.0"/);
  assert.doesNotMatch(settingsNavSrc, /"0\.1\.0"/);
  assert.match(settingsNavSrc, /updateStore\.buildInfo\.version/);
});
