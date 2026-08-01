import { defineConfig } from "vitest/config"
import path from "path"

const alias = {
  "@": path.resolve(__dirname, "."),
  // `server-only` throws unless resolved via the React Server condition,
  // which vitest doesn't set. Stub it so server modules guarded with
  // `import "server-only"` remain unit-testable.
  "server-only": path.resolve(__dirname, "test/stubs/server-only.ts"),
}

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        // Fast and hermetic — Prisma is mocked. This is what `npm run test`
        // runs, and what gates every PR.
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["lib/__tests__/**/*.test.ts"],
          // Playwright specs in e2e/ are run by `playwright test`, not vitest.
          exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
        },
      },
      {
        // Real SQL against a real Postgres. Catches what a mock cannot: SQL
        // three-valued logic, constraints, transaction isolation, indeterminate
        // row selection. Opt-in via `npm run test:integration` because it needs
        // a database; see test/integration-setup.ts for the safety guard.
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["lib/__integration__/**/*.test.ts"],
          setupFiles: ["test/integration-setup.ts"],
          // One shared database — parallel files would race on the same rows.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
})
