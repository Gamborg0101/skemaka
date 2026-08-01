export type ServiceErrorCode =
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "UPSTREAM"
  | "BAD_REQUEST"
  /** Every purchased seat is occupied — buying more is the way through. 402. */
  | "SEAT_LIMIT"

export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code: ServiceErrorCode,
  ) {
    super(message)
    this.name = "ServiceError"
  }
}

/**
 * The standard error response for a ServiceError.
 *
 * Always includes `code`. Returning only `{ error: message }` forces clients to
 * string-match to tell one failure from another — and a 402 meaning "your plan
 * is full, buy more" is a completely different UI from a 402 meaning "your trial
 * ended", yet they were indistinguishable. Matches the shape the billing guard
 * in apiGuard.ts already returns.
 */
export function serviceErrorResponse(err: ServiceError): Response {
  return Response.json(
    { error: err.message, code: err.code },
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
