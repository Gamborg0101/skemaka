import { View, Text } from "react-native"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { useActiveEntry, useClockIn, useClockOut } from "@/hooks/useClock"
import { elapsedSince, formatTime } from "@/lib/utils"
import type { Shift } from "@skemaka/types"

type Props = {
  todayShift?: Shift | null
}

export function ClockWidget({ todayShift }: Props) {
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

  if (!todayShift && !entry) return null

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
              <View className="w-2 h-2 rounded-full bg-success" />
              <Text className="text-xs font-medium text-success">Live</Text>
            </View>
          ) : null}
        </View>

        <Button
          variant={entry ? "danger" : "primary"}
          size="md"
          fullWidth
          loading={isLoading}
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
