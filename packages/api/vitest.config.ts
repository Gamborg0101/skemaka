import { defineConfig } from "vitest/config"

// Hermetic and framework-free: `client.ts` and `api.ts` carry all the real
// logic (auth headers, refresh-and-retry, pagination, sorting) and need no DOM.
// `fetch` is stubbed per-test, so nothing here touches the network.
export default defineConfig({
  test: {
    name: "unit",
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
  },
})
