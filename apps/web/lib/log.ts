/**
 * Lightweight structured logging.
 *
 * Emits one JSON object per line to stdout/stderr — the format Vercel's log
 * drains (and most log aggregators) parse natively, so production errors become
 * searchable and alertable without a third-party APM SDK.
 *
 * Two rules every call site relies on:
 *  - **PII never leaks into logs.** All context is passed through {@link scrubPii}
 *    before serialization, so wage/email/phone/token values are redacted even if
 *    a caller accidentally includes them.
 *  - **Logging never throws.** A logger that crashes the request it is meant to
 *    record is worse than no logger, so serialization failures fall back to a
 *    minimal line.
 */

type LogLevel = "error" | "warn" | "info"

/** Keys whose values are redacted anywhere they appear in a context object. */
const PII_KEYS = new Set([
  "email",
  "phone",
  "phonenumber",
  "wage",
  "hourlywage",
  "wagebase",
  "token",
  "invitetoken",
  "password",
  "secret",
  "authorization",
])

const REDACTED = "[redacted]"

/**
 * Recursively copy `value`, replacing any property whose key matches a known PII
 * key (case-insensitive) with a redaction marker. Arrays and nested objects are
 * walked; primitives pass through untouched. Cycles are guarded with a seen set.
 */
export function scrubPii(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== "object") return value

  if (seen.has(value as object)) return "[circular]"
  seen.add(value as object)

  if (Array.isArray(value)) return value.map((v) => scrubPii(v, seen))

  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = PII_KEYS.has(key.toLowerCase()) ? REDACTED : scrubPii(val, seen)
  }
  return out
}

/** Normalize an unknown thrown value into a serializable shape. */
function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack }
  }
  return { value: String(err) }
}

export type LogContext = Record<string, unknown> & {
  /** Correlates a log line to one request; set from the `x-request-id` header. */
  requestId?: string
}

function emit(level: LogLevel, scope: string, message: string, context?: LogContext) {
  let line: string
  try {
    line = JSON.stringify({
      level,
      scope,
      message,
      ...(context ? (scrubPii(context) as Record<string, unknown>) : {}),
      time: new Date().toISOString(),
    })
  } catch {
    line = JSON.stringify({ level, scope, message: "[unserializable log payload]" })
  }
  // This module is the single sanctioned console sink for the app.
  ;(level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line)
}

/** Log an error, accepting either a thrown value or a plain context object. */
export function logError(scope: string, error: unknown, context?: LogContext): void {
  emit("error", scope, error instanceof Error ? error.message : String(error), {
    ...context,
    error: serializeError(error),
  })
}

export function logWarn(scope: string, message: string, context?: LogContext): void {
  emit("warn", scope, message, context)
}

export function logInfo(scope: string, message: string, context?: LogContext): void {
  emit("info", scope, message, context)
}

/** Read the correlation id stamped onto a request by the middleware. */
export function requestIdFrom(headers: Headers): string | undefined {
  return headers.get("x-request-id") ?? undefined
}
