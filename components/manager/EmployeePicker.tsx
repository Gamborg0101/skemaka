"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ChevronDown } from "lucide-react"

type Option = { id: string; name: string; jobRole: string }

export function EmployeePicker({
  employees,
  selectedId,
  selfId,
}: {
  employees: Option[]
  selectedId: string
  selfId: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    const params = new URLSearchParams()
    const week = searchParams.get("week")
    if (week) params.set("week", week)
    if (val !== selfId) params.set("employee", val)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="relative inline-flex items-center">
      <select
        value={selectedId}
        onChange={handleChange}
        className="appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg pl-3 pr-8 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
      >
        {employees.map((emp) => (
          <option key={emp.id} value={emp.id}>
            {emp.id === selfId ? `${emp.name} (you)` : emp.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
    </div>
  )
}
