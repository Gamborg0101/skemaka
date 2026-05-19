import { ApiClient, refreshMobileToken } from "@skemaka/api"
import { useAuthStore } from "@/store/authStore"
import { API_URL } from "@/lib/constants"

// Singleton. Token is read lazily on every request so it always reflects
// the latest auth state without re-instantiation.
export const apiClient = new ApiClient(
  API_URL,
  () => useAuthStore.getState().token,
)

// Register the refresh callback.  On HTTP 401 the ApiClient will:
//   1. Call this function once (concurrent 401s share one refresh attempt)
//   2. If it returns true, retry the original request with the new token
//   3. If it returns false, throw ApiError(401) and let the UI handle sign-out
apiClient.setRefresher(async () => {
  try {
    const result = await refreshMobileToken(apiClient)
    await useAuthStore.getState().updateToken(result.token)
    return true
  } catch {
    // Refresh failed (expired, revoked, cancelled subscription) — sign out.
    await useAuthStore.getState().signOut()
    return false
  }
})
