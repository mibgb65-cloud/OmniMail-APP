import { env } from "node:process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wails from "@wailsio/runtime/plugins/vite";

const port = Number(env.WAILS_VITE_PORT ?? 9245);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("WAILS_VITE_PORT 必须是 1 到 65535 的整数。");
}

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
  },
  plugins: [react(), wails("./bindings")],
});
