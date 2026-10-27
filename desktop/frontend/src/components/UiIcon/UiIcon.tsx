import { useMemo } from 'react';

import {
  Archive,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  FileText,
  HardDrive,
  Inbox,
  Info,
  Languages,
  LayoutDashboard,
  MailCheck,
  MailOpen,
  Minus,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Square,
  SquarePen,
  Sparkles,
  Star,
  Sun,
  Trash2,
  UsersRound,
  X,
} from 'lucide';
import { fitIcon } from 'morphicons';
import { MorphIcon } from 'morphicons/react';

import { getFilledFolderIcon } from './filledFolderIcons';

// 只静态引用实际使用的功能图标；品牌图像仍由 BrandMark 和原生资源负责。
const icons = {
  compose: SquarePen,
  workspace: LayoutDashboard,
  inbox: Inbox,
  starred: Star,
  sent: Send,
  drafts: FileText,
  archive: Archive,
  deleted: Trash2,
  mailOpen: MailOpen,
  sparkles: Sparkles,
  panelRightClose: PanelRightClose,
  panelRightOpen: PanelRightOpen,
  accounts: UsersRound,
  addMailbox: Plus,
  settings: Settings,
  replay: RotateCcw,
  sun: Sun,
  moon: Moon,
  minimize: Minus,
  maximize: Square,
  restore: Copy,
  close: X,
  bell: Bell,
  language: Languages,
  check: Check,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  general: SlidersHorizontal,
  storage: HardDrive,
  about: Info,
  search: Search,
  sync: RefreshCw,
  markAllRead: MailCheck,
  previous: ChevronLeft,
  next: ChevronRight,
} as const;

export type UiIconName = keyof typeof icons;

interface UiIconProps {
  name: UiIconName;
  className?: string;
  size?: number;
  selected?: boolean;
  strokeWidth?: number;
}

export function UiIcon({ name, className, size = 18, selected, strokeWidth = 1.6 }: UiIconProps) {
  const stateful = selected !== undefined;
  const filledIcon = getFilledFolderIcon(name);
  // 文件夹选择使用真实 outline ↔ fill；其他状态按钮保留原有同形紧凑过渡。
  const compactIcon = useMemo(
    () => (stateful && !filledIcon ? fitIcon(icons[name], [-2, -2, 28, 28]) : undefined),
    [name, stateful, filledIcon],
  );
  const icon = filledIcon
    ? selected
      ? filledIcon
      : icons[name]
    : selected === false
      ? compactIcon
      : icons[name];
  return (
    <MorphIcon
      icon={icon}
      className={className}
      size={size}
      strokeWidth={strokeWidth}
      reducedMotion="user"
      aria-hidden="true"
      focusable="false"
    />
  );
}
