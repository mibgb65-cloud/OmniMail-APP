import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { DialogFrame } from '../DialogFrame/DialogFrame';
import styles from './Tasks.module.css';

export function TaskConfirm({
  title,
  children,
  confirm,
  cancel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirm: string;
  cancel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    return () => {
      if (node?.open) node.close();
    };
  }, []);
  return (
    <DialogFrame
      ref={ref}
      className={styles.confirmDialog}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div className={styles.confirmBody}>
        <h2>{title}</h2>
        {children}
        <div className={styles.confirmActions}>
          <button type="button" data-button-variant="secondary" onClick={onCancel}>
            {cancel}
          </button>
          <button
            type="button"
            className={danger ? styles.dangerButton : undefined}
            onClick={onConfirm}
          >
            {confirm}
          </button>
        </div>
      </div>
    </DialogFrame>
  );
}
