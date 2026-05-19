"use client"

import { useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { addDays } from "@/lib/dateUtils"

export function DateStepper({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const label = new Date(value + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  })
  return (
    <div className="flex items-center gap-1 rounded-lg border border-input bg-transparent h-8">
      <button
        type="button"
        onClick={() => onChange(addDays(value, -1))}
        className="flex h-full items-center px-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-l-lg transition-colors"
        aria-label="Previous day"
      >
        <ChevronLeft className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => inputRef.current?.showPicker()}
        className="flex-1 text-center text-sm font-medium text-foreground hover:text-blue-600 transition-colors"
        aria-label="Pick a date"
      >
        {label}
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={() => onChange(addDays(value, 1))}
        className="flex h-full items-center px-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-r-lg transition-colors"
        aria-label="Next day"
      >
        <ChevronRight className="size-3.5" />
      </button>
    </div>
  )
}
