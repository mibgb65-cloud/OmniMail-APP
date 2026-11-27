import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { getLegalDoc } from "../src/i18n/docsAndShortcutsEn.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("用户协议与隐私政策双语正式版均为 6 节完整条款且零草案占位提示", () => {
  for (const lang of ["zh-CN", "en-US"]) {
    for (const docType of ["terms", "privacy"]) {
      const doc = getLegalDoc(docType, lang);
      assert.equal(
        doc.sections.length,
        6,
        `${lang}/${docType} 应包含 6 条正式条款`,
      );
      assert.doesNotMatch(doc.badge, /草案|Draft/i);
      assert.doesNotMatch(doc.updatedAt, /草案|Draft/i);
      for (const sec of doc.sections) {
        assert.doesNotMatch(sec.body, /草案|法务定稿|preview draft/i);
      }
    }
  }

  const modalSrc = fs.readFileSync(
    path.join(__dirname, "../src/components/onboarding/LegalDocModal.tsx"),
    "utf8",
  );
  assert.doesNotMatch(modalSrc, /legalDraftWarning|pill-warning/);
});
