/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // bind to 0.0.0.0 so the container's port mapping works
    proxy: {
      // Dev-only proxy: browser hits localhost:5173/api/* and Vite forwards
      // to the warehouse container on the compose network. Keeps the browser
      // single-origin so we don't need CORS.
      "/api": {
        target: "http://warehouse:4001",
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
