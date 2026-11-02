import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { AccountSummary } from '../lib/bridge/mail';
import { useTranslation } from '../lib/i18n/useTranslation';
import { UiIcon } from '../components/UiIcon/UiIcon';
import styles from './ComposeSender.module.css';

export function ComposeSender({
  accounts,
  value,
  disabled,
  onChange,
}: {
  accounts: AccountSummary[];
  value: string;
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  const { t } = useTranslation('mail');
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('');
  const selected = accounts.find((account) => account.id === value);
  const available = accounts.filter((account) => account.status === 'configured');
  const activeIndex = accounts.findIndex((account) => account.id === active);
  const expanded = open && !disabled;
  useEffect(() => {
    if (!expanded) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [expanded]);
  useEffect(() => {
    if (expanded)
      document.getElementById(`${id}-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [expanded, activeIndex, id]);
  const choose = (account: AccountSummary | undefined) => {
    if (account?.status !== 'configured') return;
    onChange(account.id);
    setOpen(false);
    button.current?.focus();
  };
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || !available.length || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Tab') {
      setOpen(false);
      return;
    }
    if (event.key === 'Escape' && expanded) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    if (!expanded) {
      setActive(available.find((account) => account.id === value)?.id ?? available[0]?.id ?? '');
      setOpen(true);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      choose(accounts[activeIndex]);
      return;
    }
    const index = available.findIndex((account) => account.id === active);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? available.length - 1
          : (index + (event.key === 'ArrowUp' ? -1 : 1) + available.length) % available.length;
    setActive(available[next]?.id ?? '');
  };
  return (
    <div ref={root} className={styles.root}>
      <span id={`${id}-label`} className={styles.label}>
        {t('from')}
      </span>
      <button
        ref={button}
        id={`${id}-trigger`}
        type="button"
        role="combobox"
        className={styles.trigger}
        disabled={disabled || !available.length}
        aria-labelledby={`${id}-label`}
        aria-haspopup="listbox"
        aria-controls={expanded ? `${id}-options` : undefined}
        aria-expanded={expanded}
        aria-activedescendant={expanded && activeIndex >= 0 ? `${id}-${activeIndex}` : undefined}
        onKeyDown={keyDown}
        onClick={() => {
          setActive(
            available.find((account) => account.id === value)?.id ?? available[0]?.id ?? '',
          );
          setOpen((previous) => !previous);
        }}
      >
        <span className={styles.selected}>
          {selected?.displayName && <strong>{selected.displayName}</strong>}
          <span>
            {selected?.email || (value ? t('composeSenderUnavailable') : t('composeChooseSender'))}
          </span>
        </span>
        <UiIcon name="chevronDown" size={16} />
      </button>
      {expanded && (
        <div
          className={styles.options}
          id={`${id}-options`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          data-native-scrollbar=""
        >
          {accounts.map((account, index) => (
            <button
              key={account.id}
              id={`${id}-${index}`}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={value === account.id}
              disabled={account.status !== 'configured'}
              data-active={active === account.id}
              onPointerDown={(event) => event.preventDefault()}
              onPointerMove={() => {
                if (account.status === 'configured') setActive(account.id);
              }}
              onClick={() => choose(account)}
            >
              {account.displayName && <strong>{account.displayName}</strong>}
              <span>{account.email}</span>
              {account.status !== 'configured' && <small>{t('composeSenderUnavailable')}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
