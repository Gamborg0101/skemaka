import { View, Text, Pressable, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useCoverRequests, useClaimCover } from "@/hooks/useCover"
import { formatTime, formatDateLong } from "@/lib/utils"

/**
 * "Shifts you can cover" — the open pool a teammate has offered up. Renders
 * nothing when empty. Claiming puts the user forward; a manager confirms it.
 */
export function CoverPool() {
  const { data } = useCoverRequests()
  const claim = useClaimCover()
  const pool = data?.pool ?? []

  if (pool.length === 0) return null

  return (
    <View className="mb-4 rounded-2xl border border-brand/30 bg-brand/5 overflow-hidden">
      <View className="flex-row items-center gap-2 px-4 py-2.5 border-b border-brand/20">
        <Ionicons name="swap-horizontal" size={16} color="#7B6EF8" />
        <Text className="text-sm font-semibold text-ink">Shifts you can cover</Text>
      </View>
      {pool.map((req, i) => (
        <View
          key={req.id}
          className={`flex-row items-center justify-between gap-3 px-4 py-3 ${i > 0 ? "border-t border-brand/10" : ""}`}
        >
          <View className="flex-1">
            <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
              {req.shift.jobRole} · {formatDateLong(req.shift.date)}
            </Text>
            <Text className="text-xs text-ink-secondary mt-0.5">
              {formatTime(req.shift.startTime)}–{formatTime(req.shift.endTime)} · from {req.requesterName}
            </Text>
            {req.note ? (
              <Text className="text-xs text-ink-muted italic mt-0.5" numberOfLines={2}>
                &ldquo;{req.note}&rdquo;
              </Text>
            ) : null}
          </View>
          <Pressable
            disabled={claim.isPending}
            onPress={() =>
              claim.mutate(req.id, {
                onError: (e) =>
                  Alert.alert("Couldn't claim", e instanceof Error ? e.message : "Try again"),
              })
            }
            accessibilityRole="button"
            accessibilityLabel={`Cover the ${req.shift.jobRole} shift`}
            className="shrink-0 h-9 px-3 rounded-xl bg-brand items-center justify-center active:opacity-80 disabled:opacity-40"
          >
            <Text className="text-xs font-semibold text-white">I&apos;ll cover it</Text>
          </Pressable>
        </View>
      ))}
    </View>
  )
}
