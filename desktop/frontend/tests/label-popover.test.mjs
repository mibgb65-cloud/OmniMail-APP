import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  computeLabelTriState,
  computeSidePopoverCoords,
  countLabelUsage,
  filterLabelsWithCreateOption,
  LABEL_PRESET_SWATCHES,
} from "../src/components/mail/labelPopoverLogic.ts";
import { enUS, zhCN } from "../src/i18n/index.ts";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("LabelPickerPopover 搜索过滤、多选三态、一键新建并贴标与禁止全局删除校验", () => {
  const sampleLabels = [
    { id: "lbl-1", name: "核心工作", color: "#2563EB" },
    { id: "lbl-2", name: "账单发票", color: "#16A34A" },
    { id: "lbl-3", name: "待跟进", color: "#D97706" },
  ];
  const sampleMails = [
    { id: "m1", labels: ["lbl-1", "lbl-2"] },
    { id: "m2", labels: ["lbl-1"] },
    { id: "m3", labels: [] },
  ];

  // 多选三态：m1 + m2 同时选中时，lbl-1 为全选、lbl-2 为半选、lbl-3 为未选
  assert.equal(
    computeLabelTriState(sampleMails, ["m1", "m2"], "lbl-1"),
    "checked",
  );
  assert.equal(
    computeLabelTriState(sampleMails, ["m1", "m2"], "lbl-2"),
    "indeterminate",
  );
  assert.equal(
    computeLabelTriState(sampleMails, ["m1", "m2"], "lbl-3"),
    "unchecked",
  );

  // 搜索过滤与精确同名去重、无匹配可一键创建并应用
  const hitExisting = filterLabelsWithCreateOption(sampleLabels, "  核心工作 ");
  assert.equal(hitExisting.filtered.length, 1);
  assert.equal(hitExisting.canCreateNew, false);

  const partial = filterLabelsWithCreateOption(sampleLabels, "工作");
  assert.equal(partial.filtered.length, 1);
  assert.equal(partial.canCreateNew, true);

  const brandNew = filterLabelsWithCreateOption(sampleLabels, "黑五促销");
  assert.equal(brandNew.filtered.length, 0);
  assert.equal(brandNew.trimmedQuery, "黑五促销");
  assert.equal(brandNew.canCreateNew, true);

  // 6 色预设色板严格对齐规范
  assert.deepEqual(
    [...LABEL_PRESET_SWATCHES],
    ["#2563EB", "#4F46E5", "#16A34A", "#D97706", "#DC2626", "#0891B2"],
  );

  // 严禁在贴标轻浮层放置全局删除标签按钮（防误删）
  const pickerSrc = readFileSync(
    path.join(rootDir, "src", "components", "mail", "LabelPickerPopover.tsx"),
    "utf8",
  );
  assert.match(pickerSrc, /toggleMailLabel/);
  assert.match(pickerSrc, /createAndApplyLabel/);
  assert.doesNotMatch(pickerSrc, /deleteLabel|delete-label/);
});

test("LabelEditPopover 支持新建、renameLabel 改名改色与二次删除确认", () => {
  const editSrc = readFileSync(
    path.join(rootDir, "src", "components", "shell", "LabelEditPopover.tsx"),
    "utf8",
  );
  assert.match(editSrc, /mailStore\.createLabel/);
  assert.match(editSrc, /mailStore\.renameLabel/);
  assert.match(editSrc, /kind:\s*"delete-label"/);

  // 右侧空间不足时级联/侧栏浮层自动向左翻折并做视口边界夹紧
  const rightFit = computeSidePopoverCoords(
    { left: 20, top: 120, right: 200, bottom: 152 },
    244,
    218,
    { width: 1280, height: 800 },
  );
  assert.equal(rightFit.side, "right");
  assert.equal(rightFit.left, 206);

  const flippedLeft = computeSidePopoverCoords(
    { left: 980, top: 120, right: 1180, bottom: 152 },
    258,
    240,
    { width: 1280, height: 800 },
  );
  assert.equal(flippedLeft.side, "left");
  assert.equal(flippedLeft.left, 716);
});

test("三大入口闭环：侧边栏原地管理、右键贴标签级联、阅读器 L 快捷键与胶囊 × 直删", () => {
  const counts = countLabelUsage([
    { labels: ["lbl-1", "lbl-2"] },
    { labels: ["lbl-1"] },
  ]);
  assert.deepEqual(counts, { "lbl-1": 2, "lbl-2": 1 });

  const sidebarLblSrc = readFileSync(
    path.join(rootDir, "src", "components", "shell", "SidebarLabelSection.tsx"),
    "utf8",
  );
  assert.match(sidebarLblSrc, /LabelEditPopover/);
  assert.match(sidebarLblSrc, /onContextMenu/);
  assert.match(sidebarLblSrc, /sidebar-label-edit-btn/);
  assert.doesNotMatch(sidebarLblSrc, /type:\s*"label-manage"/);

  const ctxSrc = readFileSync(
    path.join(rootDir, "src", "components", "mail", "MailContextMenu.tsx"),
    "utf8",
  );
  assert.match(ctxSrc, /labels\.ctxApplyLabel/);
  assert.match(ctxSrc, /renderSubmenu/);
  assert.doesNotMatch(ctxSrc, /type:\s*"label-manage"/);

  const subjectSrc = readFileSync(
    path.join(
      rootDir,
      "src",
      "components",
      "mail",
      "reader",
      "ReaderSubjectSection.tsx",
    ),
    "utf8",
  );
  assert.match(subjectSrc, /reader-label-chip-remove/);
  assert.match(subjectSrc, /reader-label-add-chip/);
  assert.match(
    subjectSrc,
    /mailStore\.toggleMailLabel\(\[mail\.id\],\s*lbl\.id\)/,
  );

  const toolbarSrc = readFileSync(
    path.join(
      rootDir,
      "src",
      "components",
      "mail",
      "reader",
      "ReaderToolbar.tsx",
    ),
    "utf8",
  );
  assert.match(toolbarSrc, /READER_LABEL_SHORTCUT_EVENT/);
  assert.match(toolbarSrc, /LabelPickerPopover/);

  assert.equal(zhCN.labels.ctxApplyLabel, "贴标签");
  assert.equal(zhCN.labels.editLabelTitle, "编辑标签");
  assert.equal(enUS.labels.ctxApplyLabel, "Apply label");
  assert.equal(enUS.labels.editLabelTitle, "Edit Label");
});
