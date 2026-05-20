import { useEffect, useRef } from "react"
import { Animated, View, type ViewProps } from "react-native"

type Props = ViewProps & {
  width?: number | `${number}%`
  height?: number
  radius?: number
}

export function Skeleton({ width, height = 16, radius = 10, style, ...props }: Props) {
  const opacity = useRef(new Animated.Value(0.35)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [opacity])

  return (
    <Animated.View
      style={[{ opacity, width, height, borderRadius: radius, backgroundColor: "#252529" }, style]}
      {...props}
    />
  )
}

/** Pre-built skeleton for a ShiftCard row */
export function ShiftCardSkeleton() {
  return (
    <View className="bg-surface border border-line/60 rounded-2xl p-4 gap-2">
      <View className="flex-row items-center justify-between">
        <View className="gap-2">
          <Skeleton width={120} height={18} />
          <Skeleton width={80} height={13} />
        </View>
        <Skeleton width={32} height={13} />
      </View>
    </View>
  )
}

/** Pre-built skeleton for the ClockWidget */
export function ClockWidgetSkeleton() {
  return (
    <View className="bg-elevated border border-line/40 rounded-2xl p-4 gap-3">
      <View className="gap-1.5">
        <Skeleton width={90} height={11} />
        <Skeleton width={60} height={28} />
      </View>
      <Skeleton height={48} radius={14} />
    </View>
  )
}

/** Pre-built skeleton for an EmployeeCard row */
export function EmployeeCardSkeleton() {
  return (
    <View className="bg-surface border border-line/60 rounded-2xl px-4 py-4 flex-row items-center gap-4">
      <Skeleton width={48} height={48} radius={24} />
      <View className="flex-1 gap-2">
        <Skeleton width={128} height={15} />
        <Skeleton width={88} height={13} />
        <Skeleton width={112} height={11} />
      </View>
    </View>
  )
}

/** Pre-built skeleton for a request card */
export function RequestCardSkeleton() {
  return (
    <View className="bg-surface border border-line/60 rounded-2xl p-4">
      <View className="flex-row items-center justify-between">
        <View className="gap-2">
          <Skeleton width={140} height={15} />
          <Skeleton width={100} height={13} />
        </View>
        <Skeleton width={64} height={22} radius={100} />
      </View>
    </View>
  )
}
