import { cn } from "@/lib/utils"

/**
 * Skemaka brand mark — the "ring-top calendar".
 *
 * The mark inherits its main colour from `currentColor`, so set the text colour
 * on a parent (e.g. `text-white` on dark, `text-slate-900` on light). The single
 * highlighted date uses the `--logo-accent` CSS variable (defaults to blue-600);
 * override it on dark surfaces with `[--logo-accent:#60a5fa]` (blue-400).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role="img"
      aria-label="Skemaka"
    >
      {/* binder rings */}
      <rect x="14.4" y="5" width="3.2" height="9" rx="1.6" fill="currentColor" />
      <rect x="30.4" y="5" width="3.2" height="9" rx="1.6" fill="currentColor" />
      {/* tile */}
      <rect x="7" y="11" width="34" height="30" rx="6.5" stroke="currentColor" strokeWidth="3.2" />
      {/* header strip (rounded top, squared bottom) */}
      <rect x="7" y="11" width="34" height="8" rx="6.5" fill="currentColor" />
      <rect x="7" y="14.5" width="34" height="4.5" fill="currentColor" />
      {/* date dots — top-left accented */}
      <circle cx="18" cy="27" r="3.3" fill="var(--logo-accent, #2563eb)" />
      <circle cx="30" cy="27" r="3" fill="currentColor" opacity="0.35" />
      <circle cx="18" cy="34" r="3" fill="currentColor" opacity="0.35" />
      <circle cx="30" cy="34" r="3" fill="currentColor" opacity="0.35" />
    </svg>
  )
}

/** Mark + "Skemaka" wordmark, locked up horizontally. */
export function LogoLockup({
  className,
  markClassName,
  wordClassName,
}: {
  className?: string
  markClassName?: string
  wordClassName?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={cn("size-7 shrink-0", markClassName)} />
      <span className={cn("font-bold tracking-tight", wordClassName)}>Skemaka</span>
    </span>
  )
}
