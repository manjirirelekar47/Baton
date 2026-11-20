import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const targetUrl = process.env.VITE_API_URL || "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    host: true,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
    proxy: {
      "/health": { target: targetUrl, changeOrigin: true },
      "/auth": { target: targetUrl, changeOrigin: true },
      "/me": { target: targetUrl, changeOrigin: true },
      "/projects": { target: targetUrl, changeOrigin: true },
      "/claims": { target: targetUrl, changeOrigin: true },
      "/review": { target: targetUrl, changeOrigin: true },
      "/risk-radar": { target: targetUrl, changeOrigin: true },
      "/timeline": { target: targetUrl, changeOrigin: true },
      "/delivery-status": { target: targetUrl, changeOrigin: true },
      "/gaps": { target: targetUrl, changeOrigin: true },
      "/demo": { target: targetUrl, changeOrigin: true },
    },
  },
  build: {
    // Three.js' minified vendor chunk is ~533 kB (about 133 kB gzip) and is lazy-loaded
    // only when a dashboard hero mounts, so allow that known vendor-sized chunk.
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/three/")) return "three-vendor";
          if (id.includes("/node_modules/framer-motion/") || id.includes("/node_modules/motion-")) {
            return "motion-vendor";
          }
          if (id.includes("/node_modules/cytoscape/")) {
            return "cytoscape-vendor";
          }
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/") ||
            id.includes("/node_modules/react-router")
          ) {
            return "react-vendor";
          }
          if (id.includes("/node_modules/@tanstack/react-query")) {
            return "query-vendor";
          }
        },
      },
    },
  },
  test: { environment: "jsdom", globals: true, setupFiles: "./src/test-setup.ts", css: false },
});
