import { useId, useLayoutEffect, useRef } from 'react';
import { UiIcon, type UiIconName } from '../UiIcon/UiIcon';
import styles from './SettingsSegments.module.css';

interface Option<T extends string> {
  value: T;
  label: string;
  shortLabel: string;
  icon: UiIconName;
  disabled?: boolean;
}

// 两种三态偏好只共用呈现和键盘行为；保存成功与否仍由各自控制器决定。
export function SettingsSegments<T extends string>({
  options,
  value,
  onChange,
  labelledBy,
  describedBy,
  disabled = false,
  busy = false,
}: {
  options: readonly Option<T>[];
  value?: T;
  onChange: (value: T) => void;
  labelledBy: string;
  describedBy: string;
  disabled?: boolean;
  busy?: boolean;
}) {
  const id = useId();
  const groupRef = useRef<HTMLFieldSetElement>(null);
  const restoreKeyboardFocus = useRef(false);
  const selected = options.findIndex((option) => option.value === value);
  const focusable =
    selected >= 0 && !options[selected]?.disabled
      ? selected
      : options.findIndex((option) => !option.disabled);
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group || disabled || !restoreKeyboardFocus.current) return;
    const active = document.activeElement;
    // 异步保存会临时禁用 radio；恢复焦点，但不能抢走用户已移到别处的焦点。
    if (active !== document.body && !group.contains(active)) {
      restoreKeyboardFocus.current = false;
      return;
    }
    group.querySelector<HTMLInputElement>('input:checked:not(:disabled)')?.focus();
  }, [disabled, value]);
  return (
    <fieldset
      ref={groupRef}
      role="radiogroup"
      className={styles.track}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-busy={busy || undefined}
      disabled={disabled}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      onBlur={(event) => {
        if (!event.currentTarget.disabled && !event.currentTarget.contains(event.relatedTarget)) {
          restoreKeyboardFocus.current = false;
        }
      }}
      onKeyDown={(event) => {
        if (disabled || event.ctrlKey || event.altKey || event.metaKey) return;
        const enabled = options.filter((option) => !option.disabled);
        const current = enabled.findIndex((option) => option.value === value);
        let index: number;
        if (event.key === 'Home') index = 0;
        else if (event.key === 'End') index = enabled.length - 1;
        else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          index = current < 0 ? 0 : (current + 1) % enabled.length;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          index =
            current < 0 ? enabled.length - 1 : (current - 1 + enabled.length) % enabled.length;
        } else return;
        event.preventDefault();
        const next = enabled[index];
        if (!next) return;
        restoreKeyboardFocus.current = true;
        if (next.value !== value) onChange(next.value);
        const controls = event.currentTarget.querySelectorAll<HTMLInputElement>('input');
        controls[options.indexOf(next)]?.focus();
      }}
    >
      {selected >= 0 && (
        <span
          className={styles.indicator}
          aria-hidden="true"
          style={{
            width: `calc((100% - var(--space-1) * 2) / ${options.length})`,
            transform: `translateX(${selected * 100}%)`,
          }}
        />
      )}
      {options.map((option, index) => (
        <label key={option.value} className={styles.option}>
          <input
            type="radio"
            name={id}
            value={option.value}
            checked={value === option.value}
            aria-label={option.label}
            disabled={option.disabled}
            tabIndex={focusable === index ? 0 : -1}
            onChange={() => onChange(option.value)}
          />
          <UiIcon name={option.icon} size={15} />
          <span aria-hidden="true">{option.shortLabel}</span>
        </label>
      ))}
    </fieldset>
  );
}
