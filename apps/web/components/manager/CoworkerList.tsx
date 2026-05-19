"use client"

import { useState } from "react"
import { cn, getInitials } from "@/lib/utils"

type Coworker = { name: string; jobRole: string }

function avatarColor(name: string) {
  const palette = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-rose-500", "bg-amber-500", "bg-cyan-500"]
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return palette[hash % palette.length]
}

const PREVIEW = 4

export function CoworkerList({ coworkers }: { coworkers: Coworker[] }) {
  const [expanded, setExpanded] = useState(false)

  const visible = expanded ? coworkers : coworkers.slice(0, PREVIEW)
  const overflow = coworkers.length - PREVIEW

  return (
    <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700/60">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex -space-x-2">
          {visible.map((cw) => (
            <div
              key={cw.name}
              title={`${cw.name} · ${cw.jobRole}`}
              className={cn(
                "size-7 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-[10px] font-bold shrink-0",
                avatarColor(cw.name)
              )}
            >
              {getInitials(cw.name)}
            </div>
          ))}
        </div>

        {!expanded && overflow > 0 ? (
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            +{overflow} more
          </button>
        ) : (
          <p className="text-xs text-gray-400 truncate">
            {visible.slice(0, 2).map((cw) => cw.name.split(" ")[0]).join(", ")}
            {visible.length > 2 && ` +${visible.length - 2} more`}
          </p>
        )}
      </div>

      {expanded && (
        <div className="mt-2 space-y-1">
          {coworkers.map((cw) => (
            <p key={cw.name} className="text-xs text-gray-600 dark:text-gray-400">
              <span className="font-medium">{cw.name}</span>
              <span className="text-gray-400"> · {cw.jobRole}</span>
            </p>
          ))}
          <button
            onClick={() => setExpanded(false)}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mt-1"
          >
            Show less
          </button>
        </div>
      )}
    </div>
  )
}
