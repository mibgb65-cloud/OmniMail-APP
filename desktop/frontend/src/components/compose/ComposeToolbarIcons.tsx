import type {
  ComposeActiveFormats,
  ComposeFormatCommand,
} from "./composeEditorCommands";

export type FormatGlyphName =
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "ul"
  | "ol"
  | "quote"
  | "code"
  | "clear"
  | "link";

export interface FormatBtnDef {
  cmd: ComposeFormatCommand;
  glyph: FormatGlyphName;
  labelKey:
    | "compose.fmtBold"
    | "compose.fmtItalic"
    | "compose.fmtUnderline"
    | "compose.fmtStrike"
    | "compose.fmtUl"
    | "compose.fmtOl"
    | "compose.fmtQuote"
    | "compose.fmtCode"
    | "compose.fmtClear";
  shortcut?: string;
  activeKey?: keyof ComposeActiveFormats;
}

export const BASIC_FORMAT_BUTTONS: FormatBtnDef[] = [
  {
    cmd: "bold",
    glyph: "bold",
    labelKey: "compose.fmtBold",
    shortcut: "Ctrl+B",
    activeKey: "bold",
  },
  {
    cmd: "italic",
    glyph: "italic",
    labelKey: "compose.fmtItalic",
    shortcut: "Ctrl+I",
    activeKey: "italic",
  },
  {
    cmd: "underline",
    glyph: "underline",
    labelKey: "compose.fmtUnderline",
    shortcut: "Ctrl+U",
    activeKey: "underline",
  },
  {
    cmd: "strikeThrough",
    glyph: "strike",
    labelKey: "compose.fmtStrike",
    activeKey: "strikeThrough",
  },
];

export const BLOCK_FORMAT_BUTTONS: FormatBtnDef[] = [
  {
    cmd: "insertUnorderedList",
    glyph: "ul",
    labelKey: "compose.fmtUl",
    activeKey: "insertUnorderedList",
  },
  {
    cmd: "insertOrderedList",
    glyph: "ol",
    labelKey: "compose.fmtOl",
    activeKey: "insertOrderedList",
  },
  {
    cmd: "blockquote",
    glyph: "quote",
    labelKey: "compose.fmtQuote",
    activeKey: "blockquote",
  },
  {
    cmd: "code",
    glyph: "code",
    labelKey: "compose.fmtCode",
    activeKey: "code",
  },
  { cmd: "removeFormat", glyph: "clear", labelKey: "compose.fmtClear" },
];

export function FormatGlyph({ name }: { name: FormatGlyphName }) {
  const baseProps = {
    width: 14,
    height: 14,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.65,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
  };

  switch (name) {
    case "bold":
      return (
        <svg {...baseProps} strokeWidth={2}>
          <path d="M4.5 3h4a2.5 2.5 0 0 1 0 5h-4z" />
          <path d="M4.5 8h4.5a2.5 2.5 0 0 1 0 5H4.5z" />
        </svg>
      );
    case "italic":
      return (
        <svg {...baseProps}>
          <path d="M9.8 3H12M4 13h2.2M9.5 3L6.5 13" />
        </svg>
      );
    case "underline":
      return (
        <svg {...baseProps}>
          <path d="M4.5 3v4.5a3.5 3.5 0 0 0 7 0V3" />
          <path d="M3.5 13.5h9" />
        </svg>
      );
    case "strike":
      return (
        <svg {...baseProps}>
          <path d="M2.5 8h11" />
          <path d="M10.8 4.8C10.4 3.7 9.3 3 7.9 3 6.2 3 5 3.9 5 5.2c0 1 .7 1.6 2 2" />
          <path d="M11 10.5c0 1.4-1.3 2.5-3.1 2.5-1.6 0-2.8-.7-3.2-1.8" />
        </svg>
      );
    case "ul":
      return (
        <svg {...baseProps}>
          <circle cx="3" cy="4" r="1" fill="currentColor" stroke="none" />
          <circle cx="3" cy="8" r="1" fill="currentColor" stroke="none" />
          <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none" />
          <path d="M6 4h7.5M6 8h7.5M6 12h7.5" />
        </svg>
      );
    case "ol":
      return (
        <svg {...baseProps}>
          <path
            d="M2.5 3.5h1v2.5M2.5 6h2M2.5 9.5h2l-2 2.5h2"
            strokeWidth={1.35}
          />
          <path d="M6.5 4h7M6.5 8h7M6.5 12h7" />
        </svg>
      );
    case "quote":
      return (
        <svg {...baseProps}>
          <path d="M3 4v8" strokeWidth={2.2} />
          <path d="M6.5 5h6.5M6.5 8h5.5M6.5 11h4.5" />
        </svg>
      );
    case "code":
      return (
        <svg {...baseProps}>
          <path d="M5.5 4.5L2.5 8l3 3.5M10.5 4.5L13.5 8l-3 3.5M9 3.5l-2 9" />
        </svg>
      );
    case "clear":
      return (
        <svg {...baseProps}>
          <path d="M3.5 3.5h9M8 3.5L6.5 12.5M3 13l10-10" />
        </svg>
      );
    case "link":
      return (
        <svg {...baseProps}>
          <path d="M6.5 9.5l3-3" />
          <path d="M8.5 5l1.3-1.3a2.4 2.4 0 0 1 3.4 3.4L11.8 8.5" />
          <path d="M7.5 11l-1.3 1.3a2.4 2.4 0 0 1-3.4-3.4L4.2 7.5" />
        </svg>
      );
  }
}
