// No-op stub for the `server-only` package under vitest.
//
// `server-only` throws unless it's resolved via the React Server export
// condition, which Next.js sets for the server layer but vitest does not. In the
// real build this module resolves to an empty no-op on the server; we replicate
// that here so server modules guarded with `import "server-only"` can still be
// unit-tested. The guard's actual protection (failing a client-bundle import) is
// enforced by Next.js at build time, not by tests.
export {}
