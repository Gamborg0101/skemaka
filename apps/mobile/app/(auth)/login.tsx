import { useEffect, useState } from "react"
import { View, Text, Alert, Platform } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import * as WebBrowser from "expo-web-browser"
import * as Linking from "expo-linking"
import * as AppleAuthentication from "expo-apple-authentication"
import * as Crypto from "expo-crypto"
import { SafeAreaView } from "react-native-safe-area-context"
import { Button } from "@/components/ui/Button"
import { useAuthStore } from "@/store/authStore"
import { API_URL } from "@/lib/constants"

WebBrowser.maybeCompleteAuthSession()

export default function LoginScreen() {
  const [loading, setLoading] = useState(false)
  const [appleLoading, setAppleLoading] = useState(false)
  const [appleAvailable, setAppleAvailable] = useState(false)
  const signIn = useAuthStore((s) => s.signIn)

  useEffect(() => {
    if (Platform.OS !== "ios") return
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false))
  }, [])

  async function handleLogin() {
    setLoading(true)
    try {
      const callbackUrl = Linking.createURL("/auth/callback")
      const result = await WebBrowser.openAuthSessionAsync(
        `${API_URL}/api/auth/signin?callbackUrl=${encodeURIComponent(
          `${API_URL}/api/auth/mobile/session?redirect=${encodeURIComponent(callbackUrl)}`,
        )}`,
        callbackUrl,
      )

      if (result.type !== "success") return

      const url = new URL(result.url)

      // Prefer the newer one-time `code` flow (web redirects with ?code=).
      // Fall back to the legacy direct `token` flow for backward compatibility.
      const code = url.searchParams.get("code")
      if (code) {
        const resp = await fetch(`${API_URL}/api/auth/mobile/redeem`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        })
        if (!resp.ok) {
          Alert.alert("Login failed", "Could not exchange code for session. Please try again.")
          return
        }
        const data = await resp.json() as {
          token: string
          userId?: string | null
          orgId?:  string | null
          role?:   string | null
        }
        await signIn(data.token, { userId: data.userId, orgId: data.orgId, role: data.role })
        return
      }

      // Legacy: token delivered directly in the redirect URL
      const token = url.searchParams.get("token")
      if (!token) {
        Alert.alert("Login failed", "Could not retrieve session. Please try again.")
        return
      }
      await signIn(token)
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  async function handleAppleLogin() {
    setAppleLoading(true)
    try {
      // 1. Generate a raw random nonce (32 random bytes → hex string)
      const rawNonceBytes = await Crypto.getRandomBytesAsync(32)
      const rawNonce = Array.from(rawNonceBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")

      // 2. Hash the nonce — Apple embeds SHA256(rawNonce) in the identity token
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      )

      // 3. Request Apple credential — pass the HASHED nonce so Apple can embed it
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      })

      if (!credential.identityToken) {
        Alert.alert("Sign in failed", "Apple did not return an identity token. Please try again.")
        return
      }

      // 4. Send identityToken + rawNonce to our backend.
      //    Backend verifies SHA256(rawNonce) === token.nonce claim.
      //    fullName is only present on the user's first sign-in — pass it when available.
      const body: {
        identityToken: string
        rawNonce: string
        fullName?: { givenName: string | null; familyName: string | null }
      } = {
        identityToken: credential.identityToken,
        rawNonce,
      }

      if (credential.fullName) {
        body.fullName = {
          givenName: credential.fullName.givenName,
          familyName: credential.fullName.familyName,
        }
      }

      const resp = await fetch(`${API_URL}/api/auth/apple/native`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!resp.ok) {
        const message = await resp.text().catch(() => "Unknown error")
        Alert.alert("Sign in failed", `Could not sign in with Apple. ${message}`)
        return
      }

      // 5. Store the session — same shape as the Google code-redemption path
      const data = await resp.json() as {
        token: string
        userId?: string | null
        orgId?:  string | null
        role?:   string | null
      }
      await signIn(data.token, { userId: data.userId, orgId: data.orgId, role: data.role })
    } catch (err) {
      // ERR_REQUEST_CANCELED: user dismissed the Apple sheet — swallow silently
      if (
        err instanceof Error &&
        (err as Error & { code?: string }).code === "ERR_REQUEST_CANCELED"
      ) {
        return
      }
      Alert.alert("Error", err instanceof Error ? err.message : "Unknown error")
    } finally {
      setAppleLoading(false)
    }
  }

  return (
    <View className="flex-1 bg-base">
      <LinearGradient
        colors={["#1C1032", "#0C0C0F"]}
        locations={[0, 0.55]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Brand glow */}
      <View
        style={{
          position: "absolute",
          top: -80,
          alignSelf: "center",
          width: 320,
          height: 320,
          borderRadius: 160,
          backgroundColor: "rgba(123, 110, 248, 0.12)",
        }}
      />

      <SafeAreaView edges={["top", "bottom"]} className="flex-1 px-6 justify-between py-10">
        {/* Top — logo */}
        <View className="items-center pt-16 gap-3">
          <View className="w-16 h-16 rounded-2xl bg-brand/20 border border-brand/30 items-center justify-center">
            <Text className="text-3xl">📅</Text>
          </View>
          <View className="items-center gap-1">
            <Text className="text-3xl font-bold text-ink tracking-tight">Skemaka</Text>
            <Text className="text-base text-ink-secondary">Your shifts, always with you</Text>
          </View>
        </View>

        {/* Bottom — sign in */}
        <View className="gap-4">
          <View className="gap-3">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              onPress={() => void handleLogin()}
            >
              Continue with Google
            </Button>

            {appleAvailable && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={12}
                onPress={() => void handleAppleLogin()}
                style={{ height: 50, opacity: appleLoading ? 0.6 : 1 }}
              />
            )}

            <Text className="text-xs text-ink-muted text-center">
              Your manager sends an invite link to get started.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  )
}
