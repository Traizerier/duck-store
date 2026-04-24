/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // bind to 0.0.0.0 so the container's port mapping works
    fs: {
      // Allow importing shared/enums.json from the repo root (one level up
      // from frontend/). Vite's default `fs.strict` otherwise blocks
      // cross-project reads.
      allow: [".."],
    },
    proxy: {
      // Dev-only proxy: browser hits /api/* and Vite forwards to the
      // backend container on the compose network. Each stack has its
      // own backend at service name "backend" within its own compose
      // project, so the same target string works for both stacks.
      // Keeps the browser single-origin (no CORS).
      "/api": {
        target: "http://backend:4001",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: false,
    restoreMocks: true, // restore vi.spyOn targets between tests
  },
});
