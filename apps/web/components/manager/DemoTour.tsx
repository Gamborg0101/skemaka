"use client"

import { useEffect, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { useOrg } from "@/lib/orgContext"
import { cn } from "@/lib/utils"

/**
 * Four-step spotlight shown once, on a visitor's first look at a sandbox.
 *
 * Deliberately not a tour library: four steps did not justify a dependency, a
 * new bundle, or another thing to keep localized. The spotlight is one absolutely
 * positioned box with a huge outward box-shadow — that dims everything except
 * the target without needing an SVG mask or clip-path.
 *
 * The sequence ends on a real next action rather than a "you're done" wall,
 * which is the one thing every good product tour has in common: here's your
 * week → roll it out → staff ask to swap → go see what they see.
 *
 * Steps whose target is missing are skipped rather than pointed at nothing, so
 * this degrades quietly if the schedule page is rearranged.
 */

const STORAGE_KEY = "skemaka.demoTourSeen"

// Keys are literals, not `string` — next-intl types `t()` on the actual
// catalogue, so a typo'd or removed key is a compile error rather than a
// "manager.demoTour.step5Title" rendered to a visitor.
const STEPS = [
  { target: '[data-tour="grid"]',    titleKey: "step1Title", bodyKey: "step1Body" },
  { target: '[data-tour="rollout"]', titleKey: "step2Title", bodyKey: "step2Body" },
  { target: '[data-tour="cover"]',   titleKey: "step3Title", bodyKey: "step3Body" },
  { target: null,                    titleKey: "step4Title", bodyKey: "step4Body" },
] as const

type Rect = { top: number; left: number; width: number; height: number }

export function DemoTour() {
  const { org } = useOrg()
  const t = useTranslations("manager.demoTour")
  const [step, setStep] = useState<number | null>(null)
  // Stored with the step it was measured for, so a rect left over from the
  // previous step can never be painted against the current one.
  const [spot, setSpot] = useState<{ step: number; rect: Rect } | null>(null)

  // Start only in a sandbox, only once, and only after the schedule has had a
  // chance to render — pointing at an element that isn't there yet is worse
  // than not running at all.
  useEffect(() => {
    if (!org.isDemo) return
    try {
      if (localStorage.getItem(STORAGE_KEY)) return
    } catch {
      return // Safari private mode etc. — skip the tour rather than throw.
    }
    const id = setTimeout(() => setStep(0), 1200)
    return () => clearTimeout(id)
  }, [org.isDemo])

  const finish = useCallback(() => {
    setStep(null)
    try { localStorage.setItem(STORAGE_KEY, "1") } catch { /* not worth failing over */ }
  }, [])

  // Measure the current target, and keep the spotlight glued to it while the
  // page scrolls or resizes.
  useEffect(() => {
    if (step === null) return
    const target = STEPS[step].target
    if (!target) return

    const measure = () => {
      const el = document.querySelector(target)
      if (!el) { setSpot(null); return }
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) { setSpot(null); return }
      setSpot({ step, rect: { top: r.top, left: r.left, width: r.width, height: r.height } })
    }
    // Measure after paint, not synchronously in the effect body: layout isn't
    // settled yet on the first pass, and a synchronous setState here cascades
    // an extra render.
    const raf = requestAnimationFrame(measure)
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", measure, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", measure)
      window.removeEventListener("scroll", measure, true)
    }
  }, [step])

  useEffect(() => {
    if (step === null) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [step, finish])

  if (step === null) return null

  // Derived, never stored as null in state — see the effect above.
  const rect = spot && spot.step === step ? spot.rect : null

  const isLast = step === STEPS.length - 1
  const next = () => (isLast ? finish() : setStep(step + 1))
  const back = () => setStep(Math.max(0, step - 1))

  // Sit under the target when there's room, otherwise above it. On a phone the
  // card is pinned to the bottom regardless — there is rarely room beside
  // anything, and a card that jumps around reads as broken.
  const below = rect ? rect.top + rect.height + 12 : 0
  const roomBelow = rect ? window.innerHeight - below > 190 : false

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={t("step1Title")}>
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-blue-400 transition-all duration-200"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: "0 0 0 9999px rgba(15,23,42,0.55)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-900/55" />
      )}

      <div
        className={cn(
          "absolute w-[min(22rem,calc(100vw-2rem))] rounded-xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700 p-4",
          // Phone: always bottom-anchored. Desktop with a target: near it.
          "left-4 right-4 bottom-6 sm:right-auto",
          rect ? "sm:bottom-auto" : "sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:bottom-auto",
        )}
        style={
          rect
            ? {
                // Only applied from sm: up via the classes above; on mobile the
                // bottom/left/right classes win because top is unset there.
                top: typeof window !== "undefined" && window.innerWidth >= 640
                  ? (roomBelow ? below : Math.max(12, rect.top - 190))
                  : undefined,
                left: typeof window !== "undefined" && window.innerWidth >= 640
                  ? Math.min(Math.max(12, rect.left), window.innerWidth - 372)
                  : undefined,
              }
            : undefined
        }
      >
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t(STEPS[step].titleKey)}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{t(STEPS[step].bodyKey)}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-1" aria-hidden>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn("size-1.5 rounded-full", i === step ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600")}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={back} className="h-9 px-3 rounded-md text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
                {t("back")}
              </button>
            )}
            {!isLast && (
              <button onClick={finish} className="h-9 px-3 rounded-md text-sm font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
                {t("skip")}
              </button>
            )}
            <button onClick={next} className="h-9 px-4 rounded-md bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700">
              {isLast ? t("done") : t("next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
