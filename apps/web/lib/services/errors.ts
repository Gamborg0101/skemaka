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
