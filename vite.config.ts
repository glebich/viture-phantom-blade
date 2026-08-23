import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    port: 5175,
    strictPort: false,
  },
  build: {
    target: "es2020",
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 900,
  },
});
