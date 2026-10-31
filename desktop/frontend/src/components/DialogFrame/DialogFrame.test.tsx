import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { DialogFrame } from './DialogFrame';

it('转发原生 dialog 引用、语义与事件，不接管业务开关策略', () => {
  const ref = createRef<HTMLDialogElement>();
  const cancel = vi.fn();
  const submit = vi.fn((event) => event.preventDefault());
  const view = render(
    <DialogFrame ref={ref} open aria-label="测试弹窗" className="business-layout" onCancel={cancel}>
      <form onSubmit={submit}>
        <button type="submit">提交</button>
      </form>
    </DialogFrame>,
  );
  const dialog = screen.getByRole('dialog', { name: '测试弹窗' });
  expect(ref.current).toBe(dialog);
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(dialog).toHaveAttribute('data-dialog-frame', 'standard');
  expect(dialog).toHaveClass('business-layout');
  fireEvent(dialog, new Event('cancel'));
  expect(cancel).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: '提交' }));
  expect(submit).toHaveBeenCalledOnce();
  expect(ref.current?.open).toBe(true);
  view.unmount();
  expect(ref.current).toBeNull();
});
