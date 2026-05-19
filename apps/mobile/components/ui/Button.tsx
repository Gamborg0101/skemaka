import { Pressable, Text, ActivityIndicator, type PressableProps } from "react-native"
import * as Haptics from "expo-haptics"

type Variant = "primary" | "secondary" | "ghost" | "danger"
type Size    = "sm" | "md" | "lg"

const VARIANT_STYLES: Record<Variant, { container: string; text: string }> = {
  primary:   { container: "bg-brand active:opacity-80",                    text: "text-white font-semibold" },
  secondary: { container: "bg-elevated border border-line active:opacity-70", text: "text-ink font-medium" },
  ghost:     { container: "active:bg-elevated",                            text: "text-ink-secondary font-medium" },
  danger:    { container: "bg-danger/10 border border-danger/20 active:opacity-80", text: "text-danger font-semibold" },
}

const SIZE_STYLES: Record<Size, { container: string; text: string }> = {
  sm: { container: "h-9 px-4 rounded-xl",    text: "text-sm" },
  md: { container: "h-12 px-5 rounded-2xl",  text: "text-base" },
  lg: { container: "h-14 px-6 rounded-2xl",  text: "text-base" },
}

type Props = PressableProps & {
  variant?:  Variant
  size?:     Size
  loading?:  boolean
  fullWidth?: boolean
  children:  React.ReactNode
}

export function Button({
  variant  = "primary",
  size     = "md",
  loading  = false,
  fullWidth = false,
  children,
  onPress,
  disabled,
  ...props
}: Props) {
  const v = VARIANT_STYLES[variant]
  const s = SIZE_STYLES[size]

  async function handlePress(e: Parameters<NonNullable<PressableProps["onPress"]>>[0]) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress?.(e)
  }

  return (
    <Pressable
      className={`flex-row items-center justify-center ${v.container} ${s.container} ${fullWidth ? "w-full" : ""}`}
      disabled={disabled || loading}
      onPress={handlePress}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? "#fff" : "#7B6EF8"}
        />
      ) : (
        <Text className={`${v.text} ${s.text}`}>{children}</Text>
      )}
    </Pressable>
  )
}
