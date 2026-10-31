import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { I18nProvider } from './lib/i18n/I18nProvider';
import { applyTheme, readInitialTheme } from './lib/theme/theme';
import './styles/globals.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('应用入口不存在');
}

// 在 React 首次绘制前应用已校验的偏好，避免深色主题启动时先闪白。
applyTheme(readInitialTheme());

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
