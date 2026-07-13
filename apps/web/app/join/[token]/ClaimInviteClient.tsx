"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"

interface Props {
  token: string
}

type State =
  | { status: "requesting" }
  | { status: "enterCode"; emailHint: string; error?: string }
  | { status: "submitting"; emailHint: string }
  | { status: "success"; orgName: string; phoneVerified?: boolean }
  | { status: "error"; message: string }

// Localized fallback strings for requestVerificationCode, resolved by the
// component so the helper itself stays a pure async function.
interface RequestFallbacks {
  yourOrganisation: string
  yourEmail: string
  somethingWentWrong: string
  networkError: string
}

// Step 1: ask the server to email a verification code to the employee's address.
// Pure async helper that resolves to the next State — callers apply it via
// `.then(setState)`, keeping every state update inside a promise callback.
async function requestVerificationCode(token: string, fb: RequestFallbacks): Promise<State> {
  try {
    const res = await fetch("/api/me/claim-invite/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
    const body = (await res.json()) as {
      data?: { sent?: boolean; email?: string; alreadyLinked?: boolean; orgName?: string }
      error?: string
    }

    if (res.ok && body.data?.alreadyLinked) {
      return { status: "success", orgName: body.data.orgName ?? fb.yourOrganisation }
    }
    if (res.ok && body.data?.sent) {
      return { status: "enterCode", emailHint: body.data.email ?? fb.yourEmail }
    }
    return { status: "error", message: body.error ?? fb.somethingWentWrong }
  } catch {
    return { status: "error", message: fb.networkError }
  }
}

// Seconds the user must wait before the resend button re-arms. Keeps a slow
// first email from turning into a burst of duplicate codes (each new code
// invalidates the previous), while still giving a clear escape hatch.
const RESEND_COOLDOWN = 20

export function ClaimInviteClient({ token }: Props) {
  const t = useTranslations("auth.join")
  const tCommon = useTranslations("common")
  const [state, setState] = useState<State>({ status: "requesting" })
  const [code, setCode] = useState("")
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN)

  const fallbacks = useCallback(
    (): RequestFallbacks => ({
      yourOrganisation: t("yourOrganisation"),
      yourEmail: t("yourEmail"),
      somethingWentWrong: tCommon("somethingWentWrong"),
      networkError: tCommon("networkError"),
    }),
    [t, tCommon],
  )

  // Resend (user-triggered): show the spinner immediately, then re-request.
  const requestCode = useCallback(() => {
    setState({ status: "requesting" })
    setCooldown(RESEND_COOLDOWN)
    void requestVerificationCode(token, fallbacks()).then(setState)
  }, [token, fallbacks])

  // On mount the initial state is already "requesting"; kick off the request and
  // apply the result inside the promise callback. The ref guards against React's
  // double-invoke of effects (Strict Mode / remount) — two mount requests would
  // generate two codes and silently invalidate the one in the first email.
  const requested = useRef(false)
  useEffect(() => {
    if (requested.current) return
    requested.current = true
    void requestVerificationCode(token, fallbacks()).then(setState)
  }, [token, fallbacks])

  // Tick the resend cooldown down to zero once a code has been sent.
  useEffect(() => {
    if (state.status !== "enterCode" || cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [state.status, cooldown])

  // Step 2: submit the code to link the account.
  async function submitCode() {
    if (state.status !== "enterCode") return
    const emailHint = state.emailHint
    setState({ status: "submitting", emailHint })
    try {
      const res = await fetch("/api/me/claim-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, code }),
      })
      const body = (await res.json()) as {
        data?: { orgName: string; phoneVerified?: boolean }
        error?: string
      }

      if (res.ok && body.data) {
        setState({ status: "success", orgName: body.data.orgName, phoneVerified: body.data.phoneVerified })
        return
      }
      setState({ status: "enterCode", emailHint, error: body.error ?? tCommon("incorrectCode") })
      setCode("")
    } catch {
      setState({ status: "enterCode", emailHint, error: tCommon("networkError") })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-2xl font-bold text-gray-900 tracking-tight">Skemaka</div>

      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        {state.status === "requesting" && (
          <>
            <Loader2 className="size-10 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">{t("sending")}</p>
          </>
        )}

        {(state.status === "enterCode" || state.status === "submitting") && (
          <>
            <h1 className="text-lg font-semibold text-gray-900 mb-1">{t("codeTitle")}</h1>
            <p className="text-sm text-gray-500 mb-6">
              {t.rich("codeIntro", {
                email: state.emailHint,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => { if (e.key === "Enter" && code.length === 6) void submitCode() }}
              disabled={state.status === "submitting"}
              placeholder="••••••"
              className="w-full text-center text-2xl tracking-[0.5em] font-mono text-gray-900 placeholder:text-gray-300 border border-gray-300 rounded-lg py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            {state.status === "enterCode" && state.error && (
              <p className="text-sm text-red-500 mb-4">{state.error}</p>
            )}
            <button
              onClick={() => void submitCode()}
              disabled={state.status === "submitting" || code.length !== 6}
              className="inline-flex items-center justify-center w-full bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {state.status === "submitting" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t("linkAccount")
              )}
            </button>
            <button
              onClick={() => void requestCode()}
              disabled={state.status === "submitting" || cooldown > 0}
              className="mt-3 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              {cooldown > 0 ? tCommon("resendCodeIn", { s: cooldown }) : tCommon("resendCode")}
            </button>
          </>
        )}

        {state.status === "success" && state.phoneVerified === false && (
          <>
            <CheckCircle className="size-10 text-green-500 mx-auto mb-4" />
            <h1 className="text-lg font-semibold text-gray-900 mb-1">{t("oneMoreStep")}</h1>
            <p className="text-sm text-gray-500 mb-6">
              {t.rich("linkedVerifyIntro", {
                org: state.orgName,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
            <Link
              href="/verify-phone"
              className="inline-flex items-center justify-center w-full bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t("verifyMyPhone")}
            </Link>
          </>
        )}

        {state.status === "success" && state.phoneVerified !== false && (
          <>
            <CheckCircle className="size-10 text-green-500 mx-auto mb-4" />
            <h1 className="text-lg font-semibold text-gray-900 mb-1">{t("allSet")}</h1>
            <p className="text-sm text-gray-500 mb-6">
              {t.rich("linkedIntro", {
                org: state.orgName,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
            <Link
              href="/portal"
              className="inline-flex items-center justify-center w-full bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t("viewShifts")}
            </Link>
          </>
        )}

        {state.status === "error" && (
          <>
            <XCircle className="size-10 text-red-400 mx-auto mb-4" />
            <h1 className="text-lg font-semibold text-gray-900 mb-1">{t("linkFailed")}</h1>
            <p className="text-sm text-gray-500 mb-6">{state.message}</p>
            <Link
              href="/portal"
              className="inline-flex items-center justify-center w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-800 transition-colors"
            >
              {t("goPortal")}
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
