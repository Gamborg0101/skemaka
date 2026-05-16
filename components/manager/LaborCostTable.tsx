"use client"

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
  return (
    <div className="space-y-6">
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card size="sm" className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Total Labor Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(costs.totalCost)}
            </p>
          </CardContent>
        </Card>
        <Card size="sm" className="border-l-4 border-l-gray-300">
          <CardHeader>
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Total Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">
              {formatHours(costs.totalHours)}
            </p>
          </CardContent>
        </Card>
        <Card size="sm" className="col-span-2 sm:col-span-1 border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Avg. Hourly Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">
              {costs.totalHours > 0
                ? formatCurrency(costs.totalCost / costs.totalHours)
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {costs.entries.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-gray-500">No shifts scheduled this week</p>
            <p className="text-xs text-gray-400 mt-1">Labor costs will appear once shifts are added.</p>
          </div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead className="text-right">Rate / hr</TableHead>
              <TableHead className="text-right">Total Cost</TableHead>
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
            <TableRow className="border-t-2 border-gray-200 bg-gray-50">
              <TableCell colSpan={2} className="font-bold text-gray-900">
                Totals
              </TableCell>
              <TableCell className="text-right tabular-nums font-bold text-gray-900">
                {formatHours(costs.totalHours)}
              </TableCell>
              <TableCell />
              <TableCell className="text-right tabular-nums font-bold text-gray-900">
                {formatCurrency(costs.totalCost)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        )}
      </div>
    </div>
  )
}
