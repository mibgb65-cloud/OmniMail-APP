import { svgToIcon } from 'morphicons/adapters';

import archive from './filled/archive-box.svg?raw';
import drafts from './filled/document-text.svg?raw';
import inbox from './filled/inbox.svg?raw';
import sent from './filled/paper-airplane.svg?raw';
import starred from './filled/star.svg?raw';
import deleted from './filled/trash.svg?raw';

// Heroicons v2.2.0 的 24px solid 图形，MIT 许可原文随应用发布。
// 本地静态解析为图形数据，不向页面注入 SVG 标记，也不在运行时请求远程资源。
const filledFolderIcons = {
  inbox: svgToIcon(inbox),
  starred: svgToIcon(starred),
  sent: svgToIcon(sent),
  drafts: svgToIcon(drafts),
  archive: svgToIcon(archive),
  deleted: svgToIcon(deleted),
};

export function getFilledFolderIcon(name: string) {
  switch (name) {
    case 'inbox':
    case 'starred':
    case 'sent':
    case 'drafts':
    case 'archive':
    case 'deleted':
      return filledFolderIcons[name];
    default:
      return undefined;
  }
}
