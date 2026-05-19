import { QueryClient } from "@tanstack/react-query"
import { ApiError } from "@skemaka/api"

function isDefinitiveError(error: unknown): boolean {
  if (error instanceof ApiError) {
    // 401 is handled by ApiClient's refresh-and-retry; if it reaches here
    // the refresh failed and the user was signed out — no point retrying.
    return [401, 403, 404, 409, 422].includes(error.status)
  }
  return false
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (isDefinitiveError(error)) return false
        return failureCount < 2
      },
      staleTime: 30_000,
      gcTime:    5 * 60_000,
    },
    mutations: {
      retry: 0,
    },
  },
})
