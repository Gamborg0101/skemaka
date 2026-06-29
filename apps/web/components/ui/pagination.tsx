"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

type PaginationProps = {
  total: number
  limit: number
  offset: number
  onOffsetChange: (offset: number) => void
  /** Optional noun for the range label, e.g. "employees". */
  label?: string
}

/**
 * Offset-based pager for the list endpoints. Renders "X–Y of N" plus Prev/Next,
 * disabled at the bounds. Hidden entirely when everything fits on one page.
 */
export function Pagination({ total, limit, offset, onOffsetChange, label }: PaginationProps) {
  if (total <= limit) return null

  const start = total === 0 ? 0 : offset + 1
  const end = Math.min(offset + limit, total)
  const canPrev = offset > 0
  const canNext = end < total

  return (
    <div className="flex items-center justify-between gap-3 px-1 py-3 text-sm text-gray-600 dark:text-gray-400">
      <span className="tabular-nums">
        {start}–{end} of {total}
        {label ? ` ${label}` : ""}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!canPrev}
          onClick={() => onOffsetChange(Math.max(0, offset - limit))}
        >
          <ChevronLeft className="size-4" />
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!canNext}
          onClick={() => onOffsetChange(offset + limit)}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
