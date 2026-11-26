# TASK-20261126-009 · 修复畸形 HTML 图片 src 漏开引号导致的 URL 尾随引号污染与存量兼容

- 状态：Completed
- 实现提交：`6df7d1013fe2e9108b18933d14105891e9316795`
- 范围：
  1. 收紧 `reImgSrcAttr` 无引号分支为 `([^\s"'<>]+)`，并剔除紧贴无引号 URL 的孤立尾随引号与自闭合 `/`；
  2. 替换容易因单个残缺引号拉穿多个标签的 `reImgTag` 正则，采用受控单标签扫描器 `scanImgTags`，禁止跨 `<`/`>` 吞噬后续标签；
  3. 统一提取 `sanitizeRemoteImageURL` 净化并校验 `http://`、`https://`、`//` 外链地址，同时在 `RestoreRemoteImages` 中对已入库存量污染 `data-omnimail-src`（如尾随 `&#34;`）做去引号还原；
  4. 在 `desktop/internal/security/html_sanitizer_test.go` 补充三类回归单测并运行验证。

## 实际改动

- `desktop/internal/security/html_img_attrs.go`（131 行）：实现受控单标签扫描 `scanImgTags` / `findBoundedImgTagEnd`、收紧后的 `reImgSrcAttr` 与孤立尾随引号/`/` 剥离器 `extractImgSrcAndCleanTag`，以及外链 URL 净化函数 `sanitizeRemoteImageURL`。
- `desktop/internal/security/html_sanitizer.go`（192 行）：`ExtractHTMLReferencedCIDs`、`SanitizeMailHTML` 与 `RestoreRemoteImages` 接入受控单标签扫描与 `sanitizeRemoteImageURL`，兼容存量 `mail.db` 中带 `&#34;` 的历史记录。
- `desktop/internal/security/html_sanitizer_test.go`（108 行）：新增 `TestSanitizeMailHTMLMalformedMissingOpeningQuoteAndLegacyRestore` 覆盖 MSO 条件注释漏开引号、正文连续图片漏开引号防跨标签错配、存量 `&#34;` 污染还原三组回归用例。

## 验证结果

- `go test -v -count=1 ./internal/security/... ./internal/search/...` 全部通过。
- 全量 `task verify`（`gofmt`、Prettier、ESLint、`tsc --noEmit`、前端单测、`go vet ./...`、`go test ./...`、开发版构建）零报错通过，涉及文件均 `<= 200` 行。
