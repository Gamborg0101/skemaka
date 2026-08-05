/**
 * Client-side translation for `ServiceError` API responses.
 *
 * Services throw with an English `message` and a `code` (see
 * `lib/services/errors.ts`), plus an optional `messageKey` that identifies
 * the *exact* failure — `code` alone is too coarse, since several unrelated
 * messages can share e.g. CONFLICT. Routes forward all of this verbatim as
 * `{ error, code, messageKey, messageParams }`.
 *
 * This resolves a known `messageKey` to a `common.serviceErrors.*` catalog
 * key. Deliberately does NOT take next-intl's `useTranslations` translator as
 * a parameter — threading its type (a deeply recursive
 * `NamespacedMessageKeys` union) through a shared helper trips TS2589 "Type
 * instantiation is excessively deep" from contravariance in its call
 * signature. Callers resolve the key here, then call `t(key as never,
 * params)` themselves at the call site — see usage in ClaimInviteClient.tsx.
 *
 * Anything not in {@link KNOWN_SERVICE_ERROR_KEYS} (including a missing
 * `messageKey`) means "no translation" — the caller should fall back to the
 * server's English `error` string, so an unrecognised failure still shows
 * something useful, never a raw key or a blank. If `error` is missing too,
 * the caller's own generic fallback applies.
 */

/** The subset of a ServiceError JSON response this cares about. */
export interface ServiceErrorBody {
  error?: string
  code?: string
  messageKey?: string
  messageParams?: Record<string, string | number>
}

/**
 * Keys with a translation under `common.serviceErrors` in every locale.
 * Keep in sync with `packages/i18n/src/messages/{en,da}/common.json`.
 */
const KNOWN_SERVICE_ERROR_KEYS = new Set([
  "employeeDuplicateEmail",
  "seatLimit",
  "shiftConflict",
  "inviteAlreadyClaimed",
  "inviteInvalidOrExpired",
  "offerAlreadyResolved",
  "requestAlreadyResolved",
  "noEmployeeProfile",
])

/**
 * Resolve the `common` namespace key to translate for this response body
 * (e.g. `"serviceErrors.shiftConflict"`), or `undefined` if `messageKey` is
 * missing or unrecognised — in which case the caller should fall back to
 * `body.error`.
 */
export function resolveServiceErrorMessageKey(
  body: ServiceErrorBody | null | undefined,
): string | undefined {
  const key = body?.messageKey
  return key && KNOWN_SERVICE_ERROR_KEYS.has(key) ? `serviceErrors.${key}` : undefined
}

/**
 * A plain, loosely-typed translate function: `(key, values?) => string`.
 * Build one at each call site by wrapping `useTranslations("common")`, e.g.
 *
 * ```ts
 * const translate: Translate = useCallback(
 *   (key, values) => tCommon(key as never, values),
 *   [tCommon],
 * )
 * ```
 *
 * The `as never` cast belongs in that one-line wrapper, not in this module —
 * see the file header for why threading next-intl's own translator type
 * through a shared helper doesn't typecheck.
 */
export type Translate = (key: string, values?: Record<string, string | number>) => string

/**
 * Resolve the best user-facing message for a ServiceError response body:
 * the translated string for a known `messageKey`, else the server's English
 * `error`, else `fallback`.
 */
export function translateServiceError(
  translate: Translate,
  body: ServiceErrorBody | null | undefined,
  fallback: string,
): string {
  const key = resolveServiceErrorMessageKey(body)
  if (key) return translate(key, body?.messageParams)
  return body?.error || fallback
}
