import { View, type ViewProps } from "react-native"

type Elevation = "flat" | "raised"

type Props = ViewProps & {
  elevation?: Elevation
  padded?: boolean
}

export function Card({ elevation = "raised", padded = true, className = "", children, ...props }: Props) {
  const base = elevation === "flat"
    ? "bg-surface border border-line/60 rounded-2xl"
    : "bg-elevated border border-line/40 rounded-2xl"

  return (
    <View className={`${base} ${padded ? "p-4" : ""} ${className}`} {...props}>
      {children}
    </View>
  )
}
