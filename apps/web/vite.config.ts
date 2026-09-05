import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const hmrClientPort = Number(process.env.VITE_HMR_CLIENT_PORT ?? 0);
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react()],
  server: {
    ...(hmrClientPort > 0 ? { hmr: { clientPort: hmrClientPort } } : {}),
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    exclude: ["e2e/**", "node_modules/**"],
  },
});
