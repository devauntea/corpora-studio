import tauriConfig from "./src-tauri/tauri.conf.json" with { type: "json" };
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    port: 1420,
    strictPort: true,
    host: "127.0.0.1",
    watch: {
      ignored: [
        "**/src-tauri/**",
        "**/releases/**",
        "**/qa/**",
        "**/test-results/**",
      ],
    },
  },
  clearScreen: false,
  preview: {
    headers: { "Content-Security-Policy": tauriConfig.app.security.csp },
  },
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks: (id) =>
          id.includes("node_modules/three/") ? "three" : undefined,
      },
    },
  },
});
