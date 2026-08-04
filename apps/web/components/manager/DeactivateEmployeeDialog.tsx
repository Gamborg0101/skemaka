"use client"

import { useState } from "react"
import { AlertTriangle, Calendar, Clock } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { LOCALE_TAGS, type Locale } from "@skemaka/i18n"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Employee } from "@/types"

export interface UpcomingShift {
  id: string
  date: string
  startTime: string
  endTime: string
  jobRole: string
}

interface DeactivateEmployeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: Employee
  upcomingShifts: UpcomingShift[]
  onConfirm: (deleteShifts: boolean) => void
}

function fmtDate(date: string, localeTag: string) {
  return new Date(date + "T12:00:00").toLocaleDateString(localeTag, {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

export function DeactivateEmployeeDialog({
  open,
  onOpenChange,
  employee,
  upcomingShifts,
  onConfirm,
}: DeactivateEmployeeDialogProps) {
  const t = useTranslations("manager.deactivateDialog")
  const tCommon = useTranslations("common")
  const localeTag = LOCALE_TAGS[useLocale() as Locale]
  const [deleteShifts, setDeleteShifts] = useState(false)

  const handleConfirm = () => {
    onConfirm(deleteShifts)
    onOpenChange(false)
  }

  const handleCancel = () => {
    setDeleteShifts(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("title", { name: employee.name })}</DialogTitle>
        </DialogHeader>

        <div className="flex items-start gap-3 py-1">
          <div className="mt-0.5 size-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="size-4 text-amber-500" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t("warning", { name: employee.name })}
          </p>
        </div>

        {upcomingShifts.length > 0 && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <label className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors border-b border-gray-200 dark:border-gray-700">
              <input
                type="checkbox"
                className="size-4 rounded border-gray-300 accent-red-600"
                checked={deleteShifts}
                onChange={(e) => setDeleteShifts(e.target.checked)}
              />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                {t("alsoDeleteShifts", { count: upcomingShifts.length })}
              </span>
            </label>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700 bg-gray-50 dark:bg-gray-900/40">
              {upcomingShifts.map((shift) => (
                <li
                  key={shift.id}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 text-sm transition-opacity",
                    deleteShifts ? "opacity-40" : "opacity-100"
                  )}
                >
                  <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                    <Calendar className="size-3 shrink-0 text-gray-400" />
                    {fmtDate(shift.date, localeTag)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="size-3 text-gray-400" />
                    {shift.startTime}–{shift.endTime}
                    <span className="ml-1 text-gray-400 font-medium">{shift.jobRole}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {upcomingShifts.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("keepShiftsNote", { name: employee.name })}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {tCommon("cancel")}
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
