import { useState } from "react"
import { View, Text, Pressable } from "react-native"
import { useAuthStore } from "@/store/authStore"
import { API_URL } from "@/lib/constants"

/**
 * Test-only sign-in, so automated UI runs (Maestro) can reach the authenticated
 * screens. Without it every tab is unreachable to a test, because the real flow
 * is Google/Apple OAuth in a WebView.
 *
 * Signs in through the PUBLIC "live demo" provider — the same one the marketing
 * site's "Try the live demo" button uses. That choice is deliberate:
 *
 *   - it needs no password, so no shared secret has to exist anywhere
 *   - it needs no server env flag, so nothing has to be switched on in an
 *     environment where it could be forgotten
 *   - it lands in a THROWAWAY org (isDemo, deleted after 48h) with realistic
 *     seeded data — never a real customer's restaurant
 *
 * The alternative was the e2e credentials provider, which would have meant
 * enabling E2E_TEST_LOGIN on a dev server whose DATABASE_URL points at
 * PRODUCTION — a password backdoor to live customer data. Not worth it for a
 * test fixture.
 *
 * Gated on `__DEV__`, which is false in any release build, so this never ships.
 */
export function DevLogin() {
  const signIn = useAuthStore((s) => s.signIn)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!__DEV__) return null

  async function handle() {
    setBusy(true)
    setError(null)
    try {
      // 1. CSRF token — NextAuth rejects credential posts without it.
      const csrfRes = await fetch(`${API_URL}/api/auth/csrf`)
      if (!csrfRes.ok) throw new Error(`csrf ${csrfRes.status}`)
      const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }

      // 2. Sign in as a fresh demo restaurant. Sets the session cookie.
      const res = await fetch(`${API_URL}/api/auth/callback/demo`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken, json: "true" }).toString(),
      })
      if (res.status >= 400) throw new Error(`demo sign-in rejected (${res.status})`)

      // 3. Exchange the cookie for a Bearer token — the same JSON mode the real
      //    OAuth flow reaches after redeeming its one-time code.
      const sessRes = await fetch(`${API_URL}/api/auth/mobile/session`)
      if (!sessRes.ok) throw new Error(`session ${sessRes.status}`)
      const session = (await sessRes.json()) as {
        token?: string
        userId?: string | null
        orgId?: string | null
        role?: string | null
      }
      if (!session.token) throw new Error("no token returned")

      await signIn(session.token, {
        userId: session.userId,
        orgId: session.orgId,
        role: session.role,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "sign-in failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <View className="gap-2 mt-6 p-3 rounded-xl border border-dashed border-ink-secondary/40">
      <Text className="text-xs text-ink-secondary">Dev builds only — signs into a throwaway demo restaurant</Text>
      <Pressable
        testID="dev-signin"
        accessibilityLabel="Dev sign in"
        onPress={() => void handle()}
        disabled={busy}
        className="px-3 py-2 rounded-lg bg-white/20 items-center"
      >
        <Text className="text-ink font-semibold">{busy ? "Signing in…" : "Dev sign in"}</Text>
      </Pressable>
      {error && (
        <Text testID="dev-error" className="text-xs text-red-400">
          {error}
        </Text>
      )}
    </View>
  )
}
