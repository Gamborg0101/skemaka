import { ApiClient, ApiError } from "@skemaka/api"
import { useAuthStore } from "@/store/authStore"
import { decodeJwtPayload } from "@/store/authStore"
import { API_URL } from "@/lib/constants"

// Singleton. Token is read lazily on every request so it always reflects
// the latest auth state without re-instantiation.
export const apiClient = new ApiClient(
  API_URL,
  () => useAuthStore.getState().token,
)

// Proactive expiry check: refresh the token if it expires within 30 seconds.
// This prevents a request from failing with a 401 when we know the token is stale.
apiClient.setProactiveRefreshCheck((token: string) => {
  const payload = decodeJwtPayload(token)
  const exp = payload.exp as number | undefined
  return Boolean(exp && exp * 1000 < Date.now() + 30_000)
})

// Register the refresh callback.  On HTTP 401 the ApiClient will:
//   1. Call this function once (concurrent 401s share one refresh attempt)
//   2. If it returns true, retry the original request with the new token
//   3. If it returns false, throw ApiError(401) and let the UI handle sign-out
//
// IMPORTANT: We use bare fetch() here — NOT apiClient.post() — so that the
// refresh request cannot itself trigger another 401 → refresh recursion.
apiClient.setRefresher(async () => {
  try {
    const currentToken = useAuthStore.getState().token
    if (!currentToken) {
      await useAuthStore.getState().signOut()
      return false
    }

    const resp = await fetch(`${API_URL}/api/auth/mobile/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentToken}`,
      },
      body: JSON.stringify({ token: currentToken }),
    })

    if (!resp.ok) {
      throw new ApiError("Refresh failed", resp.status)
    }

    const result = await resp.json() as { token: string }
    await useAuthStore.getState().updateToken(result.token)
    return true
  } catch {
    // Refresh failed (expired, revoked, cancelled subscription) — sign out.
    await useAuthStore.getState().signOut()
    return false
  }
})
