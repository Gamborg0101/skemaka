"use client"

import { useState } from "react"
import { CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { AvailabilityRequest, Employee } from "@/types"
import { getWeekDays } from "@/lib/dateUtils"

// ── Mock data ─────────────────────────────────────────────────────────────────
// TODO: fetch from /api/availability/[token] (public endpoint, no auth required)

const MOCK_EMPLOYEE: Employee = {
  id: "emp-1",
  organizationId: "org-1",
  userId: null,
  name: "Sophie Andersen",
  email: "sophie@example.com",
  phone: null,
  jobRole: "Barista",
  hourlyWage: 15.5,
  notes: null,
  employmentType: "PART_TIME" as const,
  contractedHours: 0,
  isActive: true,
  inviteToken: "mock-token",
  inviteExpiry: null,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
}

const MOCK_REQUEST: AvailabilityRequest = {
  id: "req-1",
  organizationId: "org-1",
  weekStart: "2026-05-18",
  deadline: "2026-05-15T23:59:59Z",
  status: "OPEN",
  createdAt: "2026-05-12T10:00:00Z",
}

const ORG_NAME = "The Daily Grind"

// ── Types ─────────────────────────────────────────────────────────────────────

type DayAvailability = {
  date: string
  isAvailable: boolean
  preferredStart: string
  preferredEnd: string
}

const DAY_LABELS: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr)
  return DAY_LABELS[d.getDay()] ?? dateStr
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AvailabilityTokenPage() {
  const employee = MOCK_EMPLOYEE
  const request = MOCK_REQUEST

  const days = getWeekDays(request.weekStart)

  const [availability, setAvailability] = useState<DayAvailability[]>(
    days.map((date) => ({
      date,
      isAvailable: false,
      preferredStart: "",
      preferredEnd: "",
    }))
  )

  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const toggleAvailable = (date: string) => {
    setAvailability((prev) =>
      prev.map((d) =>
        d.date === date ? { ...d, isAvailable: !d.isAvailable } : d
      )
    )
  }

  const updateTime = (
    date: string,
    field: "preferredStart" | "preferredEnd",
    value: string
  ) => {
    setAvailability((prev) =>
      prev.map((d) => (d.date === date ? { ...d, [field]: value } : d))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: POST /api/availability/[token]/submit
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 800))
    setSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="size-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">All done!</h1>
          <p className="mt-2 text-gray-500">
            Your availability has been submitted. Your manager will build the schedule and let you know your shifts.
          </p>
          <p className="mt-6 text-sm text-gray-400">{ORG_NAME}</p>
        </div>
      </div>
    )
  }

  const weekLabel = new Date(request.weekStart).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          {ORG_NAME}
        </p>
        <h1 className="text-xl font-bold text-gray-900 mt-0.5">
          Hi {employee.name.split(" ")[0]},
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Share your availability for the week of{" "}
          <span className="font-medium text-gray-700">{weekLabel}</span>.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-5 space-y-3 max-w-lg mx-auto">
        {availability.map((day) => (
          <div
            key={day.date}
            className={cn(
              "rounded-xl border-2 bg-white overflow-hidden transition-colors",
              day.isAvailable ? "border-blue-500" : "border-gray-200"
            )}
          >
            {/* Day header — tap to toggle */}
            <button
              type="button"
              onClick={() => toggleAvailable(day.date)}
              className="flex w-full items-center justify-between px-4 py-4"
            >
              <div className="text-left">
                <p className="font-semibold text-gray-900">{getDayLabel(day.date)}</p>
                <p className="text-sm text-gray-500">{formatDateShort(day.date)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "text-sm font-medium",
                    day.isAvailable ? "text-blue-600" : "text-gray-400"
                  )}
                >
                  {day.isAvailable ? "Available" : "Not Available"}
                </span>
                {/* Toggle pill */}
                <div
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    day.isAvailable ? "bg-blue-600" : "bg-gray-200"
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
                      day.isAvailable ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </div>
              </div>
            </button>

            {/* Time inputs — shown when available */}
            {day.isAvailable && (
              <div className="border-t border-gray-100 px-4 py-4 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`start-${day.date}`} className="text-xs text-gray-500">
                    Preferred start (optional)
                  </Label>
                  <Input
                    id={`start-${day.date}`}
                    type="time"
                    value={day.preferredStart}
                    onChange={(e) =>
                      updateTime(day.date, "preferredStart", e.target.value)
                    }
                    className="h-11 text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`end-${day.date}`} className="text-xs text-gray-500">
                    Preferred end (optional)
                  </Label>
                  <Input
                    id={`end-${day.date}`}
                    type="time"
                    value={day.preferredEnd}
                    onChange={(e) =>
                      updateTime(day.date, "preferredEnd", e.target.value)
                    }
                    className="h-11 text-base"
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Submit */}
        <div className="pt-3">
          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700 text-white"
          >
            {submitting ? "Submitting..." : "Submit Availability"}
          </Button>
        </div>
      </form>
    </div>
  )
}
