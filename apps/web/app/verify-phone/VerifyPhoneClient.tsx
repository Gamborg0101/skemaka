"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Loader2, Phone } from "lucide-react"

interface Props {
  orgName: string
  /** E.164 dial-code prefix pre-filled into the phone field, e.g. "+45". */
  defaultDialCode: string
}

// Seconds before the resend button re-arms — matches the email claim flow.
const RESEND_COOLDOWN = 20

type State =
  | { status: "enterPhone"; error?: string }
  | { status: "sending" }
  | { status: "enterCode"; phoneHint: string; error?: string }
  | { status: "submitting"; phoneHint: string }

export function VerifyPhoneClient({ orgName, defaultDialCode }: Props) {
  const t = useTranslations("auth.verifyPhone")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const [state, setState] = useState<State>({ status: "enterPhone" })
  const [phone, setPhone] = useState(defaultDialCode)
  const [code, setCode] = useState("")
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN)

  // Tick the resend cooldown down once a code has been sent.
  useEffect(() => {
    if (state.status !== "enterCode" || cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [state.status, cooldown])

  async function requestCode() {
    setState({ status: "sending" })
    try {
      const res = await fetch("/api/me/phone/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })
      const body = (await res.json()) as {
        data?: { sent?: boolean; phone?: string; devCode?: string }
        error?: string
      }
      if (res.ok && body.data?.sent) {
        // Dev/e2e only — server returns devCode outside production.
        if (body.data.devCode) setCode(body.data.devCode)
        setCooldown(RESEND_COOLDOWN)
        setState({ status: "enterCode", phoneHint: body.data.phone ?? phone })
        return
      }
      setState({ status: "enterPhone", error: body.error ?? t("errSend") })
    } catch {
      setState({ status: "enterPhone", error: tCommon("networkError") })
    }
  }

  async function submitCode() {
    if (state.status !== "enterCode") return
    const phoneHint = state.phoneHint
    setState({ status: "submitting", phoneHint })
    try {
      const res = await fetch("/api/me/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      })
      const body = (await res.json()) as { data?: { verified: boolean }; error?: string }
      if (res.ok && body.data?.verified) {
        router.replace("/portal")
        return
      }
      setState({ status: "enterCode", phoneHint, error: body.error ?? tCommon("incorrectCode") })
      setCode("")
    } catch {
      setState({ status: "enterCode", phoneHint, error: tCommon("networkError") })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-2xl font-bold text-gray-900 tracking-tight">Skemaka</div>

      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        {(state.status === "enterPhone" || state.status === "sending") && (
          <>
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-blue-50">
              <Phone className="size-6 text-blue-600" />
            </div>
            <h1 className="text-lg font-semibold text-gray-900 mb-1">{t("title")}</h1>
            <p className="text-sm text-gray-500 mb-6">
              {t("intro", { orgName })}
            </p>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && phone.trim().length > 4) void requestCode() }}
              disabled={state.status === "sending"}
              placeholder="+4520123456"
              className="w-full text-center text-lg font-mono text-gray-900 placeholder:text-gray-300 border border-gray-300 rounded-lg py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            {state.status === "enterPhone" && state.error && (
              <p className="text-sm text-red-500 mb-4">{state.error}</p>
            )}
            <button
              onClick={() => void requestCode()}
              disabled={state.status === "sending" || phone.trim().length <= 4}
              className="inline-flex items-center justify-center w-full bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {state.status === "sending" ? <Loader2 className="size-4 animate-spin" /> : t("sendCode")}
            </button>
            {/* The way out. A verified number is what SMS notifications need,
                not what reading your own roster needs — the portal layout says
                as much and deliberately stopped gating on it. This page never
                got the matching exit, so anyone whose code fails to arrive
                (wrong country code, carrier delay, an SMS provider still on a
                trial that only texts pre-verified numbers) was left staring at
                a red error with nowhere to go. The banner in the portal keeps
                asking, so nothing is lost by letting them through. */}
            <Link
              href="/portal"
              className="mt-4 block text-sm text-gray-500 underline underline-offset-2 hover:text-gray-700"
            >
              {t("skipForNow")}
            </Link>
          </>
        )}

        {(state.status === "enterCode" || state.status === "submitting") && (
          <>
            <h1 className="text-lg font-semibold text-gray-900 mb-1">{t("codeTitle")}</h1>
            <p className="text-sm text-gray-500 mb-6">
              {t.rich("codeIntro", {
                phone: state.phoneHint,
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
              {state.status === "submitting" ? <Loader2 className="size-4 animate-spin" /> : t("verifyContinue")}
            </button>
            <button
              onClick={() => void requestCode()}
              disabled={state.status === "submitting" || cooldown > 0}
              className="mt-3 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              {cooldown > 0 ? tCommon("resendCodeIn", { s: cooldown }) : tCommon("resendCode")}
            </button>
            <button
              onClick={() => setState({ status: "enterPhone" })}
              disabled={state.status === "submitting"}
              className="mt-2 block w-full text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              {t("differentNumber")}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
