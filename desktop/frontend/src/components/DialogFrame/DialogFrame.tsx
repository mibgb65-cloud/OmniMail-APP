import { forwardRef, type ComponentPropsWithoutRef, type SyntheticEvent } from 'react';

import styles from './DialogFrame.module.css';

type Props = ComponentPropsWithoutRef<'dialog'> & { closing?: boolean };
const blockDuringExit = (event: SyntheticEvent) => {
  event.preventDefault();
  event.stopPropagation();
};

/** 共用视觉外框与退出交互门禁；业务通过 useDialogExit 协调关闭，请求取消仍由业务负责。 */
export const DialogFrame = forwardRef<HTMLDialogElement, Props>(function DialogFrame(
  { className, closing, onClickCapture, onKeyDownCapture, onSubmitCapture, ...props },
  ref,
) {
  return (
    <dialog
      {...props}
      ref={ref}
      aria-modal="true"
      data-dialog-frame="standard"
      data-closing={closing ? 'true' : undefined}
      className={[styles.frame, className].filter(Boolean).join(' ')}
      onClickCapture={closing ? blockDuringExit : onClickCapture}
      onKeyDownCapture={closing ? blockDuringExit : onKeyDownCapture}
      onSubmitCapture={closing ? blockDuringExit : onSubmitCapture}
    />
  );
});
