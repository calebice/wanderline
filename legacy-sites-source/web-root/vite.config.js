var _a;
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
    base: (_a = process.env.VITE_BASE_PATH) !== null && _a !== void 0 ? _a : "/",
    plugins: [react()],
    server: process.env.VITE_DEV_API_PROXY ? {
        proxy: {
            "/api": {
                target: process.env.VITE_DEV_API_PROXY,
                changeOrigin: true,
            },
        },
    } : undefined,
    test: {
        environment: "jsdom",
        setupFiles: "./src/test/setup.ts",
        exclude: ["e2e/**", "node_modules/**"],
    },
});
