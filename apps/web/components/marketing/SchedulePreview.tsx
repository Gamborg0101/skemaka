import { AlertTriangle } from "lucide-react"
import { useTranslations } from "next-intl"

// A real, in-DOM preview of a Friday dinner-service schedule — rendered live rather
// than shipped as a screenshot, so it can never go stale and never shows seed/
// placeholder names. The cast matches the /demo restaurant ("The Copper Pan").

type Row = {
  name: string
  roleKey: "roleHeadChef" | "roleSousChef" | "roleBartender" | "roleWaiter"
  start: number // 24h decimal, e.g. 15.5 = 15:30
  end: number
  color: string // chip background
  conflict?: boolean
}

const WINDOW_START = 12
const WINDOW_END = 24
const SPAN = WINDOW_END - WINDOW_START

const ROWS: Row[] = [
  { name: "Peter", roleKey: "roleHeadChef", start: 14, end: 23.5, color: "bg-amber-400" },
  { name: "Anna", roleKey: "roleSousChef", start: 15, end: 23.5, color: "bg-amber-400" },
  { name: "Julie", roleKey: "roleBartender", start: 16, end: 24, color: "bg-purple-400" },
  { name: "Emma", roleKey: "roleWaiter", start: 16, end: 23.5, color: "bg-blue-400" },
  { name: "Thomas", roleKey: "roleWaiter", start: 17, end: 23.5, color: "bg-blue-400", conflict: true },
]

function label(h: number) {
  const hh = Math.floor(h) % 24
  const mm = Math.round((h - Math.floor(h)) * 60)
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}

export function SchedulePreview() {
  const t = useTranslations("marketing.preview")
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-green-500" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            {t("header")}
          </span>
        </div>
        <span className="text-[11px] font-medium text-gray-400 tabular-nums">{t("wages")}</span>
      </div>

      <div className="space-y-2.5 px-4 py-4">
        {ROWS.map((r) => {
          const offset = ((r.start - WINDOW_START) / SPAN) * 100
          const width = ((r.end - r.start) / SPAN) * 100
          return (
            <div key={r.name} className="flex items-center gap-3">
              <div className="w-24 shrink-0">
                <p className="text-xs font-semibold text-gray-800 leading-tight">{r.name}</p>
                <p className="text-[10px] text-gray-400 leading-tight">{t(r.roleKey)}</p>
              </div>
              <div className="relative h-5 flex-1">
                <div
                  className={`absolute inset-y-0 rounded-md ${r.color} ${r.conflict ? "ring-2 ring-red-500" : ""}`}
                  style={{ left: `${offset}%`, width: `${width}%` }}
                />
                {r.conflict && (
                  <span className="absolute -top-0.5 flex items-center gap-0.5 text-[9px] font-semibold text-red-600"
                    style={{ left: `calc(${offset}% + 4px)` }}>
                    <AlertTriangle className="size-2.5" /> {t("onLeave")}
                  </span>
                )}
              </div>
              <span className="w-20 shrink-0 text-right text-[10px] text-gray-400 tabular-nums">
                {label(r.start)}–{label(r.end)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex justify-between border-t border-gray-100 px-4 py-2 text-[9px] text-gray-300 tabular-nums">
        {["12:00", "15:00", "18:00", "21:00", "00:00"].map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>
    </div>
  )
}
