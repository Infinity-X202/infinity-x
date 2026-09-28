import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@ixm/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
        xfwd: true,
        timeout: 600_000,
        proxyTimeout: 600_000,
      },
      "/ws": { target: "http://127.0.0.1:3000", ws: true, changeOrigin: true, xfwd: true },
    },
  },
  preview: { port: 4173 },
});
