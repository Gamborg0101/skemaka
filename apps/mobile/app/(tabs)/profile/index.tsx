import { View, Text, Alert } from "react-native"
import { Screen } from "@/components/layout/Screen"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Divider } from "@/components/ui/Divider"
import { ErrorState } from "@/components/feedback/ErrorState"
import { useAuthStore } from "@/store/authStore"
import { useCurrentUser } from "@/hooks/useEmployee"

type InfoRowProps = { label: string; value: string | null | undefined }

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <View className="flex-row items-center justify-between py-3">
      <Text className="text-sm text-ink-secondary">{label}</Text>
      <Text className="text-sm font-medium text-ink">{value ?? "—"}</Text>
    </View>
  )
}

export default function ProfileScreen() {
  const { employee, signOut } = useAuthStore()
  const { isError, refetch } = useCurrentUser()

  if (isError) {
    return (
      <Screen>
        <ErrorState
          message="Could not load your profile."
          onRetry={() => void refetch()}
        />
      </Screen>
    )
  }

  const initials = employee?.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("") ?? "?"

  function handleSignOut() {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ])
  }

  return (
    <Screen scroll>
      <View className="gap-6">
        {/* Avatar + name */}
        <View className="items-center gap-3 pt-4">
          <View className="w-20 h-20 rounded-full bg-brand/20 border-2 border-brand/40 items-center justify-center">
            <Text className="text-2xl font-bold text-brand">{initials}</Text>
          </View>
          <View className="items-center gap-0.5">
            <Text className="text-xl font-bold text-ink">{employee?.name ?? "Loading…"}</Text>
            {employee?.jobRole ? (
              <Text className="text-sm text-ink-secondary">{employee.jobRole}</Text>
            ) : null}
          </View>
        </View>

        {/* Details */}
        <Card elevation="flat" padded={false} className="px-4">
          <InfoRow label="Email" value={employee?.email} />
          <Divider />
          <InfoRow label="Phone" value={employee?.phone ?? "Not set"} />
          <Divider />
          <InfoRow label="Role" value={employee?.jobRole} />
        </Card>

        {/* Actions */}
        <Button
          variant="danger"
          size="md"
          fullWidth
          onPress={handleSignOut}
        >
          Sign Out
        </Button>
      </View>
    </Screen>
  )
}
