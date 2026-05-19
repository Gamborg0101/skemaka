import { create } from "zustand"
import * as SecureStore from "expo-secure-store"
import { TOKEN_KEY } from "@/lib/constants"

export type EmployeeProfile = {
  id: string
  name: string
  email: string
  jobRole: string
  phone: string | null
}

type AuthState = {
  token:     string | null
  userId:    string | null
  orgId:     string | null
  role:      string | null
  employee:  EmployeeProfile | null
  isLoading: boolean

  signIn:      (token: string) => Promise<void>
  signOut:     () => Promise<void>
  /**
   * Stores a refreshed JWT without a full sign-in round-trip.
   * Called by the apiClient refresher when `POST /api/auth/mobile/refresh` succeeds.
   */
  updateToken: (token: string) => Promise<void>
  setEmployee: (employee: EmployeeProfile) => void
  hydrate:     () => Promise<void>
}

function decodeJwtPayload(token: string): {
  sub?: string; orgId?: string; role?: string; exp?: number
} {
  try {
    const [, payload] = token.split(".")
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))
  } catch {
    return {}
  }
}

function claimsFromToken(token: string) {
  const p = decodeJwtPayload(token)
  return {
    token,
    userId: p.sub   ?? null,
    orgId:  p.orgId ?? null,
    role:   p.role  ?? null,
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token:     null,
  userId:    null,
  orgId:     null,
  role:      null,
  employee:  null,
  isLoading: true,

  signIn: async (token) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token)
    set({ ...claimsFromToken(token), isLoading: false })
  },

  signOut: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
    set({ token: null, userId: null, orgId: null, role: null, employee: null, isLoading: false })
  },

  updateToken: async (token) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token)
    set(claimsFromToken(token))
  },

  setEmployee: (employee) => set({ employee }),

  hydrate: async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY)

    if (!token) {
      set({ isLoading: false })
      return
    }

    const payload = decodeJwtPayload(token)

    // Remove tokens that are already expired — the ApiClient refresher handles
    // expiry during an active session (401 → refresh → retry).
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      await SecureStore.deleteItemAsync(TOKEN_KEY)
      set({ isLoading: false })
      return
    }

    set({ ...claimsFromToken(token), isLoading: false })
  },
}))
