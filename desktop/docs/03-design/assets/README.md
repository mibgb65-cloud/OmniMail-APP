# 设计资源（assets）

> 状态：草稿 | 负责人：@design-lead | 最后更新：2026-10-15

---

## 1. 目录结构

```
assets/
├── logo/            应用图标与品牌
│   ├── app-icon-1024.png
│   ├── app-icon.icns        (macOS)
│   ├── app-icon.ico         (Windows, 16/24/32/48/64/128/256)
│   └── tray/
│       ├── tray-light.png   (Windows 浅色任务栏用深色图标)
│       ├── tray-dark.png
│       └── trayTemplate.png (macOS 模板图，自动适配明暗)
├── illustrations/   空态插画（SVG，单色 + 一种强调色）
├── wireframes/      线框图（SVG/PNG，标注版本）
└── screenshots/     界面截图（带版本号与主题后缀）
```

## 2. 命名规范

`<类型>-<用途>-<变体>@<倍率>.<ext>`

- 示例：`app-icon.ico`、`tray-dark@2x.png`、`wireframe-inbox-v1.svg`、`screen-compose-dark-1.2.0.png`。
- 截图必须带版本与主题：`screen-<页面>-<light|dark>-<version>.png`。
- 不允许出现 `final`、`new`、`copy`、`v2真的最后一版` 这类命名。

## 3. 图标规格

| 用途 | 尺寸 | 格式 |
| --- | --- | --- |
| 应用图标 | 1024×1024 源图 | PNG 源 + 平台格式导出 |
| Windows 图标 | 16/24/32/48/64/128/256 多尺寸 | `.ico`（单文件多尺寸） |
| macOS 图标 | 16-1024 多尺寸 | `.icns` |
| 托盘 | 16×16、32×32 | PNG（透明底） |
| 空态插画 | 160×160 | SVG（内联，无外链字体） |

## 4. 视觉基调

- 品牌色：`#1a63d8`（与 `--color-accent` 一致）。
- 应用图标：信封轮廓 + 多账号层叠意象，线稿 1.5px 等宽，圆角容器 22.6% 圆角（macOS 网格）。
- 深色任务栏需要浅色图标（`tray-dark.png`），macOS 用模板图自动反色。

## 5. 导出与交付

> 本目录只登记**应存在**的资源清单。实际二进制资源由设计产出后放入对应路径，
> 并在下表登记来源与版本。未登记的资源视为未评审。

| 资源 | 状态 | 版本 | 来源 |
| --- | --- | --- | --- |
| `logo/app-icon-1024.png` | 待产出 | — | — |
| `logo/app-icon.ico` | 待产出 | — | — |
| `logo/app-icon.icns` | 待产出 | — | — |
| `logo/tray/tray-light.png` | 待产出 | — | — |
| `logo/tray/tray-dark.png` | 待产出 | — | — |
| `logo/tray/trayTemplate.png` | 待产出 | — | — |
| `illustrations/empty-inbox.svg` | 待产出 | — | — |
| `illustrations/empty-search.svg` | 待产出 | — | — |
| `illustrations/empty-error.svg` | 待产出 | — | — |

## 6. 资源接入应用

| 资源 | 接入位置 |
| --- | --- |
| 应用图标 | `desktop/build/appicon.png`（Wails 构建时转换） |
| 托盘图标 | `desktop/build/tray*.png`，由 `internal/platform` 加载 |
| 空态插画 | `frontend/src/assets/illustrations/`（内联 SVG 组件） |

## 7. 规则

- 源文件（Figma/AI/PSD）不入库，只入库导出产物；源文件链接登记在本文末尾。
- 图片体积：单张 PNG ≤ 200KB，SVG ≤ 30KB（不含内联字体）。
- 禁止在代码中引用远程图片 URL。
