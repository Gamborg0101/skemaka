import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    // Playwright specs in e2e/ are run by `playwright test`, not vitest.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
})
