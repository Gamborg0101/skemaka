"use client"

import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/lib/orgSettings"
import type { WeeklyLaborCost } from "@/types"

interface LaborCostTableProps {
  costs: WeeklyLaborCost
}

function formatHours(hours: number) {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function LaborCostTable({ costs }: LaborCostTableProps) {
  const t = useTranslations("manager.costs")
  return (
    <div className="space-y-6">
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card size="sm" className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {t("totalLabourCost")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              {formatCurrency(costs.totalCost)}
            </p>
          </CardContent>
        </Card>
        <Card size="sm" className="border-l-4 border-l-gray-300 dark:border-l-gray-600">
          <CardHeader>
            <CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {t("totalHours")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              {formatHours(costs.totalHours)}
            </p>
          </CardContent>
        </Card>
        <Card size="sm" className="col-span-2 sm:col-span-1 border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {t("avgHourlyRate")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              {costs.totalHours > 0
                ? formatCurrency(costs.totalCost / costs.totalHours)
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        {costs.entries.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t("noShiftsScheduled")}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t("noShiftsHint")}</p>
          </div>
        ) : (
        <>
        {/* Mobile: stacked cards — the 5-column table doesn't fit under ~640px */}
        <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
          {costs.entries.map((entry) => (
            <div key={entry.employee.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-50 truncate">
                    {entry.employee.name}
                    <span className="text-gray-400 dark:text-gray-600 font-normal"> · </span>
                    <span className="text-gray-500 dark:text-gray-400 font-normal">{entry.employee.jobRole}</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
                    {t("colHours")}: {formatHours(entry.totalHours)}
                    <span className="text-gray-300 dark:text-gray-700"> · </span>
                    {t("colRatePerHr")}: {formatCurrency(entry.employee.hourlyWage)}
                  </p>
                </div>
                <p className="shrink-0 text-base font-bold tabular-nums text-gray-900 dark:text-gray-50">
                  {formatCurrency(entry.totalCost)}
                </p>
              </div>
            </div>
          ))}
          <div className="px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-200 dark:border-gray-700">
            <div>
              <p className="font-bold text-sm text-gray-900 dark:text-gray-50">{t("totals")}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums mt-0.5">
                {t("colHours")}: {formatHours(costs.totalHours)}
              </p>
            </div>
            <p className="text-base font-bold tabular-nums text-gray-900 dark:text-gray-50">
              {formatCurrency(costs.totalCost)}
            </p>
          </div>
        </div>

        {/* Desktop / tablet: full table */}
        <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colEmployee")}</TableHead>
              <TableHead>{t("colRole")}</TableHead>
              <TableHead className="text-right">{t("colHours")}</TableHead>
              <TableHead className="text-right">{t("colRatePerHr")}</TableHead>
              <TableHead className="text-right">{t("colTotalCost")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {costs.entries.map((entry) => (
              <TableRow key={entry.employee.id}>
                <TableCell className="font-medium">{entry.employee.name}</TableCell>
                <TableCell className="text-gray-500">{entry.employee.jobRole}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatHours(entry.totalHours)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-gray-500">
                  {formatCurrency(entry.employee.hourlyWage)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatCurrency(entry.totalCost)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <TableCell colSpan={2} className="font-bold text-gray-900 dark:text-gray-50">
                {t("totals")}
              </TableCell>
              <TableCell className="text-right tabular-nums font-bold text-gray-900 dark:text-gray-50">
                {formatHours(costs.totalHours)}
              </TableCell>
              <TableCell />
              <TableCell className="text-right tabular-nums font-bold text-gray-900 dark:text-gray-50">
                {formatCurrency(costs.totalCost)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        </div>
        </>
        )}
      </div>
    </div>
  )
}
