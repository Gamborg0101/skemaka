import { View, Text, Alert } from "react-native"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { useActiveEntry, useClockIn, useClockOut } from "@/hooks/useClock"
import { elapsedSince, formatTime } from "@/lib/utils"
import type { Shift } from "@skemaka/types"
// Live indicator: color dot is decorative — the text label "Live" provides the signal

type Props = {
  todayShift?: Shift | null
  /** Always render the widget even with no shift (e.g. manager view). */
  alwaysShow?: boolean
}

function formatClockTime(iso: string): string {
  const d = new Date(iso)
  const h = String(d.getHours()).padStart(2, "0")
  const m = String(d.getMinutes()).padStart(2, "0")
  return `${h}:${m}`
}

export function ClockWidget({ todayShift, alwaysShow = false }: Props) {
  const { data: entry } = useActiveEntry()
  const clockIn  = useClockIn()
  const clockOut = useClockOut()
  const [elapsed, setElapsed] = useState("—")

  useEffect(() => {
    if (!entry) return
    setElapsed(elapsedSince(entry.clockIn))
    const id = setInterval(() => setElapsed(elapsedSince(entry.clockIn)), 10_000)
    return () => clearInterval(id)
  }, [entry])

  const isLoading = clockIn.isPending || clockOut.isPending
  const clockError = clockIn.error ?? clockOut.error

  // Surface errors as an Alert so they're impossible to miss
  useEffect(() => {
    if (!clockError) return
    const msg = clockError instanceof Error ? clockError.message : "Clock action failed. Please try again."
    Alert.alert("Clock error", msg)
  }, [clockError])

  // Already clocked in and out today — show the summary, no action needed
  const alreadyWorked = !entry && todayShift?.clockedInAt && todayShift?.clockedOutAt

  if (!alwaysShow && !todayShift && !entry) return null

  if (alreadyWorked) {
    return (
      <Card elevation="raised" className="overflow-hidden">
        <View className="absolute inset-0 bg-success/5" />
        <View className="gap-1">
          <Text className="text-xs font-medium text-ink-secondary uppercase tracking-wide">
            Worked today
          </Text>
          <Text className="text-xl font-bold text-ink tracking-tight">
            {formatClockTime(todayShift!.clockedInAt!)} – {formatClockTime(todayShift!.clockedOutAt!)}
          </Text>
        </View>
      </Card>
    )
  }

  return (
    <Card elevation="raised" className="overflow-hidden">
      <View className="absolute inset-0 bg-brand/5" />

      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-xs font-medium text-ink-secondary uppercase tracking-wide">
              {entry ? "On the clock" : "Today's shift"}
            </Text>
            {entry ? (
              <Text className="text-3xl font-bold text-ink tracking-tight mt-0.5">{elapsed}</Text>
            ) : todayShift ? (
              <Text className="text-xl font-bold text-ink tracking-tight mt-0.5">
                {formatTime(todayShift.startTime)} – {formatTime(todayShift.endTime)}
              </Text>
            ) : null}
          </View>

          {entry ? (
            <View className="flex-row items-center gap-1.5">
              {/* Color dot is decorative — "Live" text provides the non-color signal */}
              <View className="w-2 h-2 rounded-full bg-success" importantForAccessibility="no" accessibilityElementsHidden />
              <Text className="text-xs font-medium text-success">Live</Text>
            </View>
          ) : null}
        </View>

        {clockError ? (
          <Text className="text-xs text-danger text-center">
            {clockError instanceof Error ? clockError.message : "Clock action failed"}
          </Text>
        ) : null}

        <Button
          variant={entry ? "danger" : "primary"}
          size="md"
          fullWidth
          loading={isLoading}
          accessibilityLabel={entry ? "Clock out" : "Clock in"}
          accessibilityRole="button"
          onPress={() => {
            if (entry) {
              clockOut.mutate(undefined)
            } else {
              clockIn.mutate(undefined)
            }
          }}
        >
          {entry ? "Clock Out" : "Clock In"}
        </Button>
      </View>
    </Card>
  )
}
