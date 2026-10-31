import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { UiIcon } from '../UiIcon/UiIcon';
import { getSearchShortcutLabel } from './searchShortcut';
import styles from './SearchField.module.css';

interface SearchFieldProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  clearLabel: string;
  placeholder?: string;
  describedBy?: string;
  maxLength?: number;
  className?: string;
}

export function SearchField({
  label,
  value,
  onValueChange,
  clearLabel,
  placeholder,
  describedBy,
  maxLength = 200,
  className,
}: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const inputId = useId();
  const shortcut = getSearchShortcutLabel();
  const hasValue = value.length > 0;
  // 快捷键徽章只在空且未聚焦时出现，聚焦或有内容时让位给输入内容与清除按钮
  const showShortcut = !hasValue && !focused;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || event.altKey || event.shiftKey) {
        return;
      }
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const clear = useCallback(() => {
    onValueChange('');
    // 清空后保持聚焦，便于直接重新输入
    inputRef.current?.focus();
  }, [onValueChange]);

  return (
    <div className={className ? `${styles.field} ${className}` : styles.field}>
      <UiIcon name="search" size={16} strokeWidth={1.75} className={styles.icon} />
      <input
        ref={inputRef}
        id={inputId}
        className={styles.input}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label={label}
        aria-describedby={describedBy}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
      />
      {showShortcut ? (
        <kbd className={styles.shortcut} aria-hidden="true">
          {shortcut}
        </kbd>
      ) : null}
      {hasValue ? (
        <button
          type="button"
          className={styles.clear}
          aria-label={clearLabel}
          data-tooltip={clearLabel}
          onClick={clear}
          onMouseDown={(event) => event.preventDefault()}
        >
          <UiIcon name="close" size={13} strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}
