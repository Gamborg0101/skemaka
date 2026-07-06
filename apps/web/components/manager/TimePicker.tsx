"use client"

interface TimePickerProps {
  value: string
  onChange: (value: string) => void
  id?: string
}

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"))
const MINUTES = ["00", "15", "30", "45"]

const selectClass =
  "h-9 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 pr-7 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer appearance-none"

export function TimePicker({ value, onChange, id }: TimePickerProps) {
  const [rawHour, rawMinute] = value.split(":")
  const selectedHour = rawHour ?? "09"
  const selectedMinute = MINUTES.includes(rawMinute ?? "") ? (rawMinute ?? "00") : "00"

  return (
    <div id={id} className="flex items-center gap-2">
      <div className="relative">
        <select
          value={selectedHour}
          onChange={(e) => onChange(`${e.target.value}:${selectedMinute}`)}
          className={selectClass}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
      </div>
      <span className="text-gray-400 font-medium text-sm select-none">:</span>
      <div className="relative">
        <select
          value={selectedMinute}
          onChange={(e) => onChange(`${selectedHour}:${e.target.value}`)}
          className={selectClass}
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
      </div>
    </div>
  )
}
