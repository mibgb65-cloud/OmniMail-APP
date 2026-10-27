import react from '@vitejs/plugin-react';
import wails from '@wailsio/runtime/plugins/vite';
import { defineConfig } from 'vitest/config';

const port = Number(process.env.WAILS_VITE_PORT ?? 9245);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('WAILS_VITE_PORT 必须是 1024 到 65535 之间的整数');
}

export default defineConfig({
  plugins: [react(), wails('./bindings')],
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
    allowedHosts: ['localhost'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
