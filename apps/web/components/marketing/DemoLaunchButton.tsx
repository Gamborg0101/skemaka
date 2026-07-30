"use client"

import { useFormStatus } from "react-dom"
import { Loader2, ArrowRight } from "lucide-react"

/**
 * Submit button for the demo-launch form. Seeding a sandbox takes a few
 * seconds, so the pending state matters — without it the page looks dead
 * between click and redirect.
 */
export function DemoLaunchButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-700 disabled:opacity-80"
    >
      {pending ? (
        <>
          <Loader2 className="size-5 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        <>
          {label}
          <ArrowRight className="size-5" />
        </>
      )}
    </button>
  )
}
