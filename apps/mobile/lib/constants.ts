export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000"

// Token storage key in SecureStore
export const TOKEN_KEY = "skemaka_token"

// View preference key in SecureStore (manager view mode)
export const VIEW_KEY = "skemaka_view"

// Status display config — used by Badge component
export const STATUS_CONFIG = {
  PENDING:  { label: "Pending",  color: "#FFD60A", bg: "#2A2510" },
  APPROVED: { label: "Approved", color: "#30D158", bg: "#0C2016" },
  DENIED:   { label: "Denied",   color: "#FF453A", bg: "#2A0F0C" },
  OPEN:     { label: "Open",     color: "#32D7FF", bg: "#0A2228" },
  CLOSED:   { label: "Closed",   color: "#9898A8", bg: "#1C1C22" },
} as const
