import { View, Text } from "react-native"
import type { TimeOffStatus, AvailabilityRequestStatus } from "@skemaka/types"
import { STATUS_CONFIG } from "@/lib/constants"

type StatusKey = TimeOffStatus | AvailabilityRequestStatus

type Props = {
  status: StatusKey
  size?: "sm" | "md"
}

export function Badge({ status, size = "sm" }: Props) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING

  return (
    <View
      style={{ backgroundColor: cfg.bg, borderRadius: 100 }}
      accessibilityLabel={cfg.label}
      accessible
      className={size === "sm" ? "px-2.5 py-1 flex-row items-center gap-1.5" : "px-3 py-1.5 flex-row items-center gap-2"}
    >
      {/* Color dot is decorative — the text label below provides the non-color signal */}
      <View
        importantForAccessibility="no"
        accessibilityElementsHidden
        style={{ backgroundColor: cfg.color, width: size === "sm" ? 5 : 6, height: size === "sm" ? 5 : 6 }}
        className="rounded-full"
      />
      <Text
        style={{ color: cfg.color }}
        importantForAccessibility="no"
        className={size === "sm" ? "text-xs font-semibold" : "text-sm font-semibold"}
      >
        {cfg.label}
      </Text>
    </View>
  )
}
