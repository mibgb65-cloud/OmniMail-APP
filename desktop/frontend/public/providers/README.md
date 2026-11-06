# 邮箱服务商品牌图标

这些文件取自对应服务商官网公开的品牌资源或站点图标，仅用于标识用户选择的邮箱服务商。
图标随应用本地分发，界面不请求第三方图标地址。品牌及图标权利归对应权利人所有，
不适用本项目的代码许可证，也不表示获得服务商背书。

| 本地文件          | 原始来源（获取于 2026-10-29）                            | SHA-256                                                            |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| `gmail.ico`       | <https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico> | `2a5c83dd7f4634810218ba70e3fe9550fb5d887e349cb46d77419eb1c74bc299` |
| `qq.ico`          | <https://mail.qq.com/favicon.ico>                        | `0f245981be19a707f4f0ef29d59b1d0b694d8d94ee3872d17e118766b1d4ab7f` |
| `netease-163.png` | <https://mail.163.com/favicon.ico>                       | `aaa1bc04a6989c7bd8163fd163cfbdf986d9c04758b841d97d3081314a2fc50c` |
| `netease-126.png` | <https://mail.126.com/favicon.ico>                       | `aaa1bc04a6989c7bd8163fd163cfbdf986d9c04758b841d97d3081314a2fc50c` |

网易两个站点当前提供相同的品牌图标，响应虽标注 ICO，但实际为 PNG；
这里按真实文件格式保存原始字节，不重绘或修改品牌。发行前仍应按发行场景核对品牌使用规则。

## 2026-10-31：LINUX DO Mail

- 历史文件：`linuxdo.png`，原始 PNG（已于 2026-11-01 由下方透明 SVG 替换）；
  原图包含不透明方形背景，不再用于卡片或打包分发。
- 官方发布页：<https://linux.do/t/topic/120845> 中“最终新 LOGO”的公开图片。
- 原始资源：<https://cdn3.ldstatic.com/original/3X/9/7/97ed5d6d97f4c7f3dc0670d097bf457527c375f5.png>。
- SHA-256：`657c3614281b5832d35d3d8e6dd653267ba8eacbe323c298743dbad0c4aaf285`。
- 页面渲染只读取本地资源；不调用第三方图标服务，也不把论坛 OAuth 标识当作邮件登录能力。

### 2026-11-01：透明 SVG

- 当前文件：`linuxdo.svg`，直接采用官网 neo 公开的 SVG 代码，不做 AI 重绘、不改颜色/轮廓。
- 来源：<https://linux.do/t/topic/273378>，标题“LINUX DO Logo的SVG代码”，
  其中同时公布 `https://linux.do/logo-{size}.svg` 端点。
  直接资源请求被官网拒绝，未尝试绕过；本地文件来自该公开帖子展示的代码。
- 画布 120×120，圆形底层与内部 clipPath 保留黑/白/黄三条区域，圆外自然透明，
  不用混合模式、不把标志上半部的黑色一起抹掉；添加卡片和服务商浏览共用统一引用。
- SHA-256：`84b1f14168ec45eb560c23bc6944c554d0fc082a7a1be9984bcd535c73113e99`。
- 品牌权利归对应权利人，本地展示不表示服务商背书，不适用本项目代码许可证。

## 2026-10-31：NAVER、Yandex 与 iCloud

以下 ICO 均直接保存官网原始字节，已核对 ICO 文件头及大小；不重绘、不请求第三方图标服务。
品牌权利及用途边界同上，图标随应用本地分发。

| 本地文件     | 官方来源                              | SHA-256                                                            |
| ------------ | ------------------------------------- | ------------------------------------------------------------------ |
| `naver.ico`  | <https://mail.naver.com/favicon.ico>  | `56264281a44f1ec4df30977423b8f632cd773397381cc7d26689dd2cd71c0681` |
| `yandex.ico` | <https://mail.yandex.com/favicon.ico> | `73bc7e08b240af385cc79b9056ea8ff0ec3b9118bb3775521b88dbca2facc36e` |
| `icloud.ico` | <https://www.icloud.com/favicon.ico>  | `5abc82b050a4a03e9e7a2e7eed1806e79c04b46fe7c5791a02b7a3da788b50d0` |

## 2026-11-01：Yahoo Mail

- 文件：`yahoo.png`，官网 <https://mail.yahoo.com/favicon.ico> 的原始字节。
- 响应头虽标为 ICO，文件签名和内容实际为 48×48 PNG，因此按 PNG 保存；已检查尺寸、分块边界及 CRC。
- SHA-256：`c67819dc0ced5eab8731dfd011ddb5490c9c8797e3b0047aab3ad557cc60f244`。
- 仅本地展示服务商品牌，不重绘、不请求第三方图标服务，也不表示获得 Yahoo 背书。
