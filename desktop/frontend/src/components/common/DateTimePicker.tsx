import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useValuePresence } from "../../state/usePresence";
import { Icon } from "./Icon";
import {
  buildCalendarCells,
  computePopoverGeometry,
  usePopoverDismiss,
  type PopoverGeometry,
} from "./popoverPosition";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const TIME_CHIPS = ["09:00", "14:00", "18:00", "20:00"];

function parseDateTime(raw: string) {
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}:\d{2}))?/);
  const year = m ? Number(m[1]) : 2026;
  const month = m ? Number(m[2]) - 1 : 10;
  const day = m ? Number(m[3]) : 21;
  const time = m?.[4] ?? "09:00";
  return { year, month, day, time };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

interface DateTimePickerProps {
  value: string;
  onChange: (next: string) => void;
  style?: CSSProperties;
  ariaLabel?: string;
}

export function DateTimePicker({
  value,
  onChange,
  style,
  ariaLabel,
}: DateTimePickerProps) {
  const parsed = parseDateTime(value);
  const [viewYm, setViewYm] = useState({
    year: parsed.year,
    month: parsed.month,
  });
  const [geo, setGeo] = useState<PopoverGeometry | null>(null);
  const { rendered: activeGeo, closing } = useValuePresence(geo, 100);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  const isOpen = geo !== null;
  const close = useCallback(() => setGeo(null), []);
  usePopoverDismiss(isOpen, btnRef, popRef, close);

  const open = () => {
    const el = btnRef.current;
    if (!el) return;
    setViewYm({ year: parsed.year, month: parsed.month });
    setGeo(computePopoverGeometry(el, 272, 256));
  };

  const days = useMemo(
    () => buildCalendarCells(viewYm.year, viewYm.month),
    [viewYm],
  );

  const shiftMonth = (delta: -1 | 1) => {
    setViewYm((prev) => {
      const nextDate = new Date(prev.year, prev.month + delta, 1);
      return { year: nextDate.getFullYear(), month: nextDate.getMonth() };
    });
  };

  const commit = (y: number, m: number, d: number, t: string) => {
    onChange(`${y}-${pad2(m + 1)}-${pad2(d)} ${t}`);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        data-open={isOpen ? "true" : "false"}
        className="dt-picker-trigger"
        style={style}
        aria-label={ariaLabel}
        onClick={() => (isOpen ? close() : open())}
      >
        <span className="row" style={{ gap: 7 }}>
          <Icon name="calendar" size={14} />
          <span>{value}</span>
        </span>
        <Icon name="chevronDown" size={13} className="select-chevron" />
      </button>

      {activeGeo &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label="选择日期与时间"
            data-side={activeGeo.side}
            data-closing={closing ? "true" : "false"}
            className="dt-picker-popover"
            style={{
              left: activeGeo.left,
              top: activeGeo.top,
              bottom: activeGeo.bottom,
            }}
          >
            <div className="row-between">
              <strong style={{ fontSize: 12.5 }}>
                {viewYm.year} 年 {viewYm.month + 1} 月
              </strong>
              <div className="row" style={{ gap: 4 }}>
                <button
                  type="button"
                  className="icon-btn icon-btn-bordered"
                  style={{ width: 24, height: 24 }}
                  onClick={() => shiftMonth(-1)}
                  aria-label="上个月"
                >
                  <Icon name="chevronLeft" size={12} />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-bordered"
                  style={{ width: 24, height: 24 }}
                  onClick={() => shiftMonth(1)}
                  aria-label="下个月"
                >
                  <Icon name="chevronRight" size={12} />
                </button>
              </div>
            </div>

            <div className="dt-weekdays">
              {WEEKDAYS.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>

            <div className="dt-days-grid">
              {days.map((c) => {
                const isSel =
                  c.y === parsed.year &&
                  c.m === parsed.month &&
                  c.d === parsed.day;
                const isToday = c.y === 2026 && c.m === 10 && c.d === 21;
                return (
                  <button
                    key={`${c.y}-${c.m}-${c.d}`}
                    type="button"
                    className={`dt-day-btn${c.muted ? " muted" : ""}${isToday && !isSel ? " today" : ""}${isSel ? " selected" : ""}`}
                    onClick={() => commit(c.y, c.m, c.d, parsed.time)}
                  >
                    {c.d}
                  </button>
                );
              })}
            </div>

            <div className="dt-time-bar">
              <span className="text-xs text-muted">时间</span>
              <div className="dt-time-chips">
                {TIME_CHIPS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`dt-time-chip${parsed.time === t ? " active" : ""}`}
                    onClick={() => {
                      commit(parsed.year, parsed.month, parsed.day, t);
                      close();
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
