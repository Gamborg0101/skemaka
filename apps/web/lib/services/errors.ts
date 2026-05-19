export type ServiceErrorCode = "NOT_FOUND" | "CONFLICT" | "FORBIDDEN" | "UPSTREAM" | "BAD_REQUEST"

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
  }
}
