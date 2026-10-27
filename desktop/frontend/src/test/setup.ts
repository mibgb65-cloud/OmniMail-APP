import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom 不实现原生 dialog API；这里只模拟状态与关闭通知，焦点约束及模糊效果另用浏览器验证。
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    if (!this.open) return;
    this.open = false;
    queueMicrotask(() => this.dispatchEvent(new Event('close')));
  };
}

afterEach(cleanup);
