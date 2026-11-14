import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  },
  test: { environment: "jsdom", globals: true, setupFiles: "./src/test-setup.ts", css: false },
});
