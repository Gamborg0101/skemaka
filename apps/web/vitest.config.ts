import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // `server-only` throws unless resolved via the React Server condition,
      // which vitest doesn't set. Stub it so server modules guarded with
      // `import "server-only"` remain unit-testable.
      "server-only": path.resolve(__dirname, "test/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    // Playwright specs in e2e/ are run by `playwright test`, not vitest.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
})
