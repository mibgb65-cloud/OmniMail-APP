import { useEffect, useState } from "react";
import { contactApi } from "../../services/backendClient";
import { isWailsDesktop } from "../../state/storageHelpers";
import type { ContactItem } from "../../types/workspace";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";

function isValidEmailToken(raw: string): boolean {
  const match = raw.match(/<([^>]+)>/);
  const email = (match ? match[1] : raw).trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function RecipientInputRow({
  label,
  values,
  contacts,
  onChange,
  trailing,
}: {
  label: string;
  values: string[];
  contacts: ContactItem[];
  onChange: (next: string[]) => void;
  trailing?: React.ReactNode;
}) {
  const [text, setText] = useState("");
  const [remoteSuggestions, setRemoteSuggestions] = useState<ContactItem[]>([]);
  const query = text.trim().toLowerCase();

  useEffect(() => {
    if (!query || !isWailsDesktop()) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void contactApi
        .suggestRecipients(query)
        .then((rows) => {
          if (active) setRemoteSuggestions(rows.slice(0, 6));
        })
        .catch(() => undefined);
    }, 120);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const suggestions = !query
    ? []
    : isWailsDesktop() && remoteSuggestions.length > 0
      ? remoteSuggestions
      : contacts
          .filter(
            (c) =>
              c.name.toLowerCase().includes(query) ||
              c.email.toLowerCase().includes(query),
          )
          .slice(0, 6);

  const commitValue = (val: string) => {
    const clean = val.trim();
    if (!clean) return;
    if (!values.includes(clean)) onChange([...values, clean]);
    setText("");
    setRemoteSuggestions([]);
  };

  return (
    <div className="compose-row" style={{ position: "relative" }}>
      <span className="compose-row-label">{label}</span>
      <div className="recipient-chips">
        {values.map((token) => {
          const invalid = !isValidEmailToken(token);
          return (
            <Tooltip
              key={token}
              label={invalid ? "邮箱格式可能不正确，发送前请检查" : token}
              placement="top"
            >
              <span className={`recipient-chip${invalid ? " invalid" : ""}`}>
                <span>{token}</span>
                <button
                  type="button"
                  aria-label={`移除 ${token}`}
                  onClick={() => onChange(values.filter((v) => v !== token))}
                >
                  <Icon name="x" size={12} />
                </button>
              </span>
            </Tooltip>
          );
        })}
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commitValue(text);
            } else if (e.key === "Backspace" && !text && values.length > 0) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (text.trim()) commitValue(text);
          }}
          placeholder="输入姓名或邮箱，回车添加…"
          style={{
            flex: 1,
            minWidth: 140,
            border: "none",
            background: "transparent",
            outline: "none",
            color: "var(--text-ink)",
            fontSize: 13,
          }}
        />
      </div>
      {trailing}

      {suggestions.length > 0 && (
        <div
          className="context-menu"
          style={{
            position: "absolute",
            top: "100%",
            left: 74,
            width: 300,
            zIndex: 70,
          }}
        >
          {suggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              className="context-menu-item"
              onMouseDown={(e) => {
                e.preventDefault();
                commitValue(`${c.name} <${c.email}>`);
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div className="text-xs text-muted">{c.email}</div>
              </div>
              {c.vip && <span className="pill pill-warning">VIP</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
