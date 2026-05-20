import { create } from "zustand"
import * as SecureStore from "expo-secure-store"
import { TOKEN_KEY, VIEW_KEY } from "@/lib/constants"

export type EmployeeProfile = {
  id: string
  name: string
  email: string
  jobRole: string
  phone: string | null
}

export type ActiveView = "MANAGER" | "EMPLOYEE"

type AuthState = {
  token:      string | null
  userId:     string | null
  orgId:      string | null
  role:       string | null
  employee:   EmployeeProfile | null
  isLoading:  boolean
  activeView: ActiveView

  signIn:        (token: string, claims?: { userId?: string | null; orgId?: string | null; role?: string | null }) => Promise<void>
  signOut:       () => Promise<void>
  /**
   * Stores a refreshed JWT without a full sign-in round-trip.
   * Called by the apiClient refresher when `POST /api/auth/mobile/refresh` succeeds.
   */
  updateToken:   (token: string) => Promise<void>
  setEmployee:   (employee: EmployeeProfile) => void
  setActiveView: (view: ActiveView) => Promise<void>
  hydrate:       () => Promise<void>
}

// Pure-JS base64url → UTF-8 decoder. Does not rely on `atob` (unavailable in
// some Hermes builds) or any external package.
const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

function base64Decode(b64: string): string {
  // Normalise base64url to standard base64 and add padding
  const str = b64.replace(/-/g, "+").replace(/_/g, "/")
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4)
  let bytes = ""
  for (let i = 0; i < padded.length; i += 4) {
    const a = BASE64_CHARS.indexOf(padded[i])
    const b = BASE64_CHARS.indexOf(padded[i + 1])
    const c = BASE64_CHARS.indexOf(padded[i + 2])
    const d = BASE64_CHARS.indexOf(padded[i + 3])
    bytes += String.fromCharCode((a << 2) | (b >> 4))
    if (padded[i + 2] !== "=") bytes += String.fromCharCode(((b & 0xf) << 4) | (c >> 2))
    if (padded[i + 3] !== "=") bytes += String.fromCharCode(((c & 0x3) << 6) | d)
  }
  // Decode UTF-8 byte string
  try {
    return decodeURIComponent(
      bytes.split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""),
    )
  } catch {
    return bytes
  }
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const parts = token.split(".")
    if (parts.length < 2) return {}
    const json = base64Decode(parts[1])
    const payload = JSON.parse(json) as Record<string, unknown>
    // Require a valid `sub` claim — tokens without it are unusable
    if (!payload?.sub) return {}
    return payload
  } catch {
    return {}
  }
}

function claimsFromToken(token: string) {
  const p = decodeJwtPayload(token)
  return {
    token,
    userId: (p.sub   as string | undefined) ?? null,
    orgId:  (p.orgId as string | undefined) ?? null,
    role:   (p.role  as string | undefined) ?? null,
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token:      null,
  userId:     null,
  orgId:      null,
  role:       null,
  employee:   null,
  isLoading:  true,
  activeView: "EMPLOYEE",

  signIn: async (token, claims) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token)
    // claimsFromToken best-effort decodes the JWT; for encrypted NextAuth JWEs
    // it returns nulls — the server-provided claims take precedence in that case.
    const decoded = claimsFromToken(token)
    set({
      token,
      userId:    claims?.userId ?? decoded.userId,
      orgId:     claims?.orgId  ?? decoded.orgId,
      role:      claims?.role   ?? decoded.role,
      isLoading: false,
    })
  },

  signOut: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
    await SecureStore.deleteItemAsync(VIEW_KEY)
    set({ token: null, userId: null, orgId: null, role: null, employee: null, isLoading: false })
  },

  updateToken: async (token) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token)
    set(claimsFromToken(token))
  },

  setEmployee: (employee) => set({ employee }),

  setActiveView: async (view) => {
    await SecureStore.setItemAsync(VIEW_KEY, view)
    set({ activeView: view })
  },

  hydrate: async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY)

    if (!token) {
      set({ isLoading: false })
      return
    }

    const payload = decodeJwtPayload(token)

    // decodeJwtPayload returns {} when the token is malformed or missing `sub`.
    // Treat that as an invalid token — delete it and continue as unauthenticated.
    if (!payload.sub) {
      await SecureStore.deleteItemAsync(TOKEN_KEY)
      await SecureStore.deleteItemAsync(VIEW_KEY)
      set({ isLoading: false })
      return
    }

    // Remove tokens that are already expired — the ApiClient refresher handles
    // expiry during an active session (401 → refresh → retry).
    if (payload.exp && (payload.exp as number) * 1000 < Date.now()) {
      await SecureStore.deleteItemAsync(VIEW_KEY)
      await SecureStore.deleteItemAsync(TOKEN_KEY)
      set({ isLoading: false })
      return
    }

    const savedView = await SecureStore.getItemAsync(VIEW_KEY)
    const activeView: ActiveView = savedView === "MANAGER" ? "MANAGER" : "EMPLOYEE"
    set({ ...claimsFromToken(token), isLoading: false, activeView })
  },
}))
