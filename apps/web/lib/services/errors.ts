export type ServiceErrorCode =
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "UPSTREAM"
  | "BAD_REQUEST"
  /** Every purchased seat is occupied — buying more is the way through. 402. */
  | "SEAT_LIMIT"

export class ServiceError extends Error {
  /**
   * Stable identifier for this exact failure, used to look up a translated
   * message client-side. `code` alone is too coarse — several unrelated
   * messages share e.g. CONFLICT — so this defaults to `code` but should be
   * given an explicit, more specific value whenever more than one message
   * shares a code. See `lib/serviceErrorMessages.ts` for the client-side map.
   */
  public readonly messageKey: string
  /** ICU placeholder values for the translated message, e.g. `{ seats: 5 }`. */
  public readonly messageParams?: Record<string, string | number>

  constructor(
    message: string,
    public readonly code: ServiceErrorCode,
    options?: { messageKey?: string; messageParams?: Record<string, string | number> },
  ) {
    super(message)
    this.name = "ServiceError"
    this.messageKey = options?.messageKey ?? code
    this.messageParams = options?.messageParams
  }
}

/**
 * The standard error response for a ServiceError.
 *
 * Always includes `code` and `messageKey`. Returning only `{ error: message }`
 * forces clients to string-match to tell one failure from another — and a 402
 * meaning "your plan is full, buy more" is a completely different UI from a
 * 402 meaning "your trial ended", yet they were indistinguishable. `message`
 * stays in English and is always sent too, as the fallback for any
 * `messageKey` the client doesn't recognise. Matches the shape the billing
 * guard in apiGuard.ts already returns.
 */
export function serviceErrorResponse(err: ServiceError): Response {
  return Response.json(
    {
      error: err.message,
      code: err.code,
      messageKey: err.messageKey,
      ...(err.messageParams ? { messageParams: err.messageParams } : {}),
    },
    { status: serviceErrorStatus(err.code) },
  )
}

export function serviceErrorStatus(code: ServiceErrorCode): number {
  switch (code) {
    case "NOT_FOUND":   return 404
    case "CONFLICT":    return 409
    case "FORBIDDEN":   return 403
    case "UPSTREAM":    return 502
    case "BAD_REQUEST": return 400
    // 402 matches the billing paywall in apiGuard: "this is a payment problem,
    // not a permissions or validation problem".
    case "SEAT_LIMIT":  return 402
  }
}
