import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { useCallback, useState } from "react";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";
import { usePaletteCommands, type PaletteCategory } from "./usePaletteCommands";

const CATEGORIES: Array<readonly [PaletteCategory, string]> = [
  ["all", "全部"],
  ["actions", "快捷操作"],
  ["accounts", "切换邮箱"],
  ["folders", "文件夹与视图"],
  ["settings", "偏好设置"],
];

export function CommandPaletteModal() {
  const { workspace } = useApp();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PaletteCategory>("all");

  const close = useCallback(
    () => workspace.setOverlay({ type: "none" }),
    [workspace],
  );
  const commands = usePaletteCommands(query, category, close);

  return (
    <div
      className="modal-backdrop"
      style={{ alignItems: "flex-start", paddingTop: 70 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="modal-card"
        style={{ maxWidth: "min(620px, calc(100vw - 48px))" }}
        role="dialog"
        aria-modal="true"
        aria-label="全局命令面板"
      >
        <div className="compose-row" style={{ padding: "12px 16px" }}>
          <Icon name="command" size={16} />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入命令、切换邮箱、跳转文件夹或搜索设置…"
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              outline: "none",
              color: "var(--text-ink)",
              fontSize: 14,
            }}
          />
          <kbd className="kbd">Esc</kbd>
        </div>

        <div
          className="row"
          style={{
            padding: "8px 16px",
            borderBottom: "1px solid var(--border-default)",
            gap: 6,
          }}
        >
          {CATEGORIES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`btn btn-sm ${category === id ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setCategory(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <FadeScroll className="modal-body command-results" label="指令搜索结果">
          {commands.map((cmd) => (
            <button
              key={cmd.id}
              type="button"
              className="context-menu-item"
              onClick={cmd.run}
            >
              <span className="row" style={{ gap: 10 }}>
                <Icon name={cmd.icon} size={15} />
                <span>
                  <div style={{ fontWeight: 600 }}>{cmd.title}</div>
                  <div className="text-xs text-muted">{cmd.hint}</div>
                </span>
              </span>
              {cmd.shortcut && <kbd className="kbd">{cmd.shortcut}</kbd>}
            </button>
          ))}
          {commands.length === 0 && (
            <div
              className="text-muted text-xs"
              style={{ padding: 24, textAlign: "center" }}
            >
              未找到匹配指令，试试输入“写邮件”“深色”或“规则”
            </div>
          )}
        </FadeScroll>
      </div>
    </div>
  );
}
