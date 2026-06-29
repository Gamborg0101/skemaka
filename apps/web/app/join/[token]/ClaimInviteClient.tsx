"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"

interface Props {
  token: string
}

type State =
  | { status: "loading" }
  | { status: "success"; orgName: string }
  | { status: "error"; message: string }

export function ClaimInviteClient({ token }: Props) {
  const [state, setState] = useState<State>({ status: "loading" })

  useEffect(() => {
    let cancelled = false

    async function claim() {
      try {
        const res = await fetch("/api/me/claim-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        })

        if (cancelled) return

        const body = await res.json() as { data?: { orgName: string }; error?: string }

        if (res.ok && body.data) {
          setState({ status: "success", orgName: body.data.orgName })
        } else {
          setState({ status: "error", message: body.error ?? "Something went wrong." })
        }
      } catch {
        if (!cancelled) {
          setState({ status: "error", message: "Network error — please try again." })
        }
      }
    }

    void claim()

    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-2xl font-bold text-gray-900 tracking-tight">Skemaka</div>

      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        {state.status === "loading" && (
          <>
            <Loader2 className="size-10 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Linking your account…</p>
          </>
        )}

        {state.status === "success" && (
          <>
            <CheckCircle className="size-10 text-green-500 mx-auto mb-4" />
            <h1 className="text-lg font-semibold text-gray-900 mb-1">You&apos;re all set!</h1>
            <p className="text-sm text-gray-500 mb-6">
              Your account is now linked to <strong>{state.orgName}</strong>.
            </p>
            <Link
              href="/portal"
              className="inline-flex items-center justify-center w-full bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              View my shifts
            </Link>
          </>
        )}

        {state.status === "error" && (
          <>
            <XCircle className="size-10 text-red-400 mx-auto mb-4" />
            <h1 className="text-lg font-semibold text-gray-900 mb-1">Link failed</h1>
            <p className="text-sm text-gray-500 mb-6">{state.message}</p>
            <Link
              href="/portal"
              className="inline-flex items-center justify-center w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Go to portal anyway
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
