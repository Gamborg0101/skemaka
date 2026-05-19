import { useState } from "react"
import { View, Text, Switch, Alert } from "react-native"
import { Screen } from "@/components/layout/Screen"
import { LoadingState } from "@/components/feedback/LoadingState"
import { ErrorState } from "@/components/feedback/ErrorState"
import { EmptyState } from "@/components/feedback/EmptyState"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Divider } from "@/components/ui/Divider"
import { useOpenRequest, useMySubmission, useSubmitAvailability } from "@/hooks/useAvailability"
import { formatDateLong, formatWeekday } from "@/lib/utils"
import { weekDays } from "@/lib/dates"

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

export default function AvailabilityScreen() {
  const { data: request, isLoading: loadingRequest, isError, refetch } = useOpenRequest()
  const { data: existing, isLoading: loadingSubmission } = useMySubmission(request?.id)
  const submit = useSubmitAvailability(request?.id)

  // Keyed by YYYY-MM-DD date, default to Mon-Fri available
  const [available, setAvailable] = useState<Record<string, boolean>>({})

  const isLoading = loadingRequest || loadingSubmission

  if (isLoading) return <LoadingState label="Loading…" />
  if (isError)   return <ErrorState onRetry={() => void refetch()} />

  if (!request) {
    return (
      <Screen>
        <EmptyState
          icon="📅"
          title="No open requests"
          description="Your manager hasn't asked for availability yet. Check back later."
        />
      </Screen>
    )
  }

  const days = weekDays(request.weekStart)

  if (existing) {
    const submittedDays = existing.days ?? []
    const avail    = submittedDays.filter((d) => d.isAvailable).map((d) => formatWeekday(d.date))
    const unavail  = submittedDays.filter((d) => !d.isAvailable).map((d) => formatWeekday(d.date))

    return (
      <Screen scroll>
        <View className="gap-4">
          <View>
            <Text className="text-2xl font-bold text-ink">Availability</Text>
            <Text className="text-sm text-ink-secondary mt-0.5">
              Submitted · Due {formatDateLong(request.deadline)}
            </Text>
          </View>

          <Card elevation="flat" className="gap-3">
            <Text className="text-xs font-semibold text-ink-secondary uppercase tracking-wide">
              Your response
            </Text>
            <Divider />
            {avail.length > 0 && (
              <View className="gap-1">
                <Text className="text-xs text-ink-muted">Available</Text>
                {avail.map((d) => (
                  <Text key={d} className="text-sm text-success">✓  {d}</Text>
                ))}
              </View>
            )}
            {unavail.length > 0 && (
              <View className="gap-1 mt-2">
                <Text className="text-xs text-ink-muted">Unavailable</Text>
                {unavail.map((d) => (
                  <Text key={d} className="text-sm text-ink-secondary">✕  {d}</Text>
                ))}
              </View>
            )}
          </Card>
        </View>
      </Screen>
    )
  }

  // Default state: Mon-Fri available, Sat-Sun unavailable
  const getAvail = (date: string, i: number) =>
    available[date] !== undefined ? available[date] : i < 5

  return (
    <Screen scroll>
      <View className="gap-5">
        <View>
          <Text className="text-2xl font-bold text-ink">Availability</Text>
          <Text className="text-sm text-ink-secondary mt-0.5">
            Due {formatDateLong(request.deadline)}
          </Text>
        </View>

        <Card elevation="flat" padded={false} className="overflow-hidden">
          {days.map((date, i) => (
            <View key={date}>
              <View className="flex-row items-center justify-between px-4 py-3.5">
                <View>
                  <Text className="text-sm font-medium text-ink">{DAY_LABELS[i]}</Text>
                  <Text className="text-xs text-ink-muted">{formatDateLong(date)}</Text>
                </View>
                <Switch
                  value={getAvail(date, i)}
                  onValueChange={(v) => setAvailable((prev) => ({ ...prev, [date]: v }))}
                  trackColor={{ false: "#252529", true: "rgba(123, 110, 248, 0.5)" }}
                  thumbColor={getAvail(date, i) ? "#7B6EF8" : "#9898A8"}
                />
              </View>
              {i < days.length - 1 && <Divider />}
            </View>
          ))}
        </Card>

        <Button
          variant="primary"
          fullWidth
          loading={submit.isPending}
          onPress={() => {
            const dayInputs = days.map((date, i) => ({
              date,
              isAvailable: getAvail(date, i),
            }))
            submit.mutate(dayInputs, {
              onError: () => Alert.alert("Error", "Could not submit. Please try again."),
            })
          }}
        >
          Submit Availability
        </Button>
      </View>
    </Screen>
  )
}
