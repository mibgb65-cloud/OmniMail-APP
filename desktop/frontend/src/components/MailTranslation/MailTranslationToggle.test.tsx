import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { MailTranslationToggle } from './MailTranslationToggle';

it('原译开关支持键盘、点击位置和拖动，拖动后不被 click 再次反转', () => {
  const changed = vi.fn();
  function Preview() {
    const [show, setShow] = useState(false);
    return (
      <MailTranslationToggle
        show={show}
        onChange={(value) => {
          changed(value);
          setShow(value);
        }}
        hint="原文/译文"
      />
    );
  }
  render(
    <I18nProvider initialLocale="zh-CN">
      <Preview />
    </I18nProvider>,
  );
  const toggle = screen.getByRole('switch', { name: '显示译文' });
  vi.spyOn(toggle, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 10, 72, 36));
  expect(toggle).not.toBeChecked();
  fireEvent.keyDown(toggle, { key: 'ArrowRight' });
  expect(toggle).toBeChecked();
  fireEvent.keyDown(toggle, { key: 'Home' });
  expect(toggle).not.toBeChecked();
  changed.mockClear();
  fireEvent.pointerDown(toggle, { pointerId: 1, clientX: 20, button: 0 });
  fireEvent.pointerMove(toggle, { pointerId: 1, clientX: 75 });
  fireEvent.pointerUp(toggle, { pointerId: 1, clientX: 75 });
  expect(toggle).toBeChecked();
  fireEvent.click(toggle, { detail: 1, clientX: 75 });
  expect(changed).toHaveBeenCalledOnce();
  fireEvent.click(toggle, { detail: 1, clientX: 20 });
  expect(toggle).not.toBeChecked();
});
