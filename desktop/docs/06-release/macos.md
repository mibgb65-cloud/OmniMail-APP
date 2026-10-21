# macOS 构建与发布

> 状态：草稿 | 负责人：@release-manager | 最后更新：2026-10-15
> 相关：[构建总则](build.md) · [发布检查单](release-checklist.md)

---

## 1. 环境要求

| 项 | 要求 |
| --- | --- |
| 构建机 | macOS 13+（Apple Silicon 或 Intel 均可） |
| Xcode CLT | `xcode-select --install` |
| Go | 1.22+（支持 cross-compile 到 amd64/arm64） |
| Wails CLI | v2.8+ |
| 证书 | Developer ID Application（分发）/ Apple Development（调试） |
| 工具 | `codesign` `xcrun notarytool` `hdiutil` `xcrun stapler` |

## 2. 构建

```bash
cd desktop
wails build -clean -platform darwin/universal \
  -ldflags "-s -w -X main.Version=$(git describe --tags)"

# 产物
# desktop/build/bin/OmniMail.app
```

- `universal` = arm64 + x86_64，产物约 2× 单架构体积，但避免用户困惑。
- 若追求体积，可分别产出 `darwin/arm64` 与 `darwin/amd64` 两个 dmg。

## 3. Info.plist 与权限

`desktop/build/darwin/Info.plist` 关键字段：

```xml
<key>CFBundleIdentifier</key>     <string>com.omnimail.desktop</string>
<key>CFBundleName</key>           <string>OmniMail</string>
<key>CFBundleShortVersionString</key> <string>VERSION</string>
<key>CFBundleVersion</key>        <string>BUILD_NUMBER</string>
<key>LSMinimumSystemVersion</key> <string>12.0</string>
<key>NSUserNotificationAlertStyle</key> <string>alert</string>
<key>NSAppleEventsUsageDescription</key>
  <string>OmniMail 需要发送 Apple 事件以打开邮件链接。</string>
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key><string>com.omnimail.desktop</string>
    <key>CFBundleURLSchemes</key><array><string>omnimail</string></array>
  </dict>
</array>
```

> 全局快捷键无需辅助功能权限（`RegisterEventHotKey`），但若后续引入键位监听则需
> `NSAccessibilityUsageDescription` 并在系统设置中引导授权。

## 4. 签名

```bash
APP="desktop/build/bin/OmniMail.app"
codesign --deep --force --options runtime --timestamp \
  --sign "Developer ID Application: COMPANY_NAME (TEAM_ID)" "$APP"

codesign --verify --deep --strict --verbose=2 "$APP"
spctl --assess --type execute --verbose "$APP"
```

- `--options runtime`（Hardened Runtime）是公证的必要条件。
- `--timestamp` 必须。
- entitlements：默认不需要；若使用自定义协议或 Apple Events，需在
  `build/darwin/entitlements.plist` 中声明最小集合。

## 5. 打包 dmg

```bash
mkdir -p dist/dmg
cp -R "$APP" dist/dmg/
ln -s /Applications dist/dmg/Applications
hdiutil create -volname "OmniMail" -srcfolder dist/dmg -ov -format UDZO \
  "dist/OmniMail-VERSION-macos-universal.dmg"
```

## 6. 公证（Notarization）

```bash
# 方式一：app-specific password
xcrun notarytool submit "dist/OmniMail-VERSION-macos-universal.dmg" \
  --apple-id "APPLE_ID" --team-id "TEAM_ID" --password "APP_SPECIFIC_PASSWORD" \
  --wait

# 方式二：keychain profile（推荐，CI 使用）
xcrun notarytool store-credentials "omnimail-notary" \
  --apple-id "APPLE_ID" --team-id "TEAM_ID" --password "APP_SPECIFIC_PASSWORD"
xcrun notarytool submit "dist/OmniMail-VERSION-macos-universal.dmg" \
  --keychain-profile "omnimail-notary" --wait

# 装订票据
xcrun stapler staple "dist/OmniMail-VERSION-macos-universal.dmg"
xcrun stapler validate "dist/OmniMail-VERSION-macos-universal.dmg"
```

- 公证失败需查 `xcrun notarytool log <submission-id> --keychain-profile omnimail-notary`。
- 常见失败：未 `--options runtime`、包含未签名嵌套二进制、`Info.plist` 缺少 `LSMinimumSystemVersion`。

## 7. 冒烟检查（macOS）

- [ ] 首次打开无"无法验证开发者"提示（已公证）
- [ ] `spctl --assess` 显示 accepted
- [ ] 菜单栏图标显示，模板图随系统深浅色自动反色
- [ ] 系统通知弹出（应用名正确、图标正确）
- [ ] `Cmd+Shift+M` 全局快捷键唤起
- [ ] `omnimail://open?...` 打开应用并定位
- [ ] 关闭窗口后仍在 Dock/菜单栏（按设置）
- [ ] 数据目录在 `~/Library/Application Support/OmniMail`
- [ ] 卸载拖入废纸篓后，数据目录按提示处理

## 8. 疑难

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| "已损坏，无法打开" | 未公证/隔离属性 | 重新公证 + staple；内部测试可 `xattr -dr com.apple.quarantine` |
| 公证报 `Invalid bundle structure` | `.app` 中有多余文件或符号链接异常 | 清理 `dist/`，确保只含 Bundle 内容 |
| 通知不弹出 | 首次未请求权限或被拒绝 | 系统设置 → 通知 → OmniMail 开启；提供应用内引导 |
| 快捷键无响应 | 与系统快捷键冲突 | 提示用户改键；记录冲突组合 |
| 托盘图标消失 | 使用彩色图标而非模板图 | 使用 `trayTemplate.png`（纯黑 + alpha） |
| 体积过大（universal） | 双架构 + 未裁剪 | `-ldflags "-s -w"`；必要时分架构发布 |
