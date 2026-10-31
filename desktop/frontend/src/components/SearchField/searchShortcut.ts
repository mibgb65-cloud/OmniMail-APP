// 快捷键徽章只做展示：Windows/Linux 用 Ctrl K，macOS 用 ⌘K。
// 单独抽成模块便于在测试中传入固定平台值，避免依赖运行环境。
export function getSearchShortcutLabel(platform: string = getPlatform()): string {
  return /mac|iphone|ipad|ipod/i.test(platform) ? '⌘K' : 'Ctrl K';
}

function getPlatform(): string {
  if (typeof navigator === 'undefined') {
    return '';
  }
  const { platform, userAgent = '' } = navigator;
  // userAgentData 尚未进入全部 TS DOM 定义，读取时按可选字段处理。
  const data = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  return [data?.platform, platform, userAgent].filter(Boolean).join(' ');
}
