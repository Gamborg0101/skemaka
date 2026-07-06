import { View, Text, Pressable, Alert, ScrollView } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import { SafeAreaView } from "react-native-safe-area-context"
import Constants from "expo-constants"
import { useState } from "react"
import { useAuthStore, type ActiveView } from "@/store/authStore"
import { apiClient } from "@/lib/apiClient"
import { ApiError } from "@skemaka/api"

// ─── Primitives ───────────────────────────────────────────────────────────────

function SectionHeader({ title, color }: { title: string; color?: string }) {
  return (
    <Text
      style={{ color: color ?? "#6B6B7B" }}
      className="text-xs font-semibold uppercase tracking-widest px-4 pt-6 pb-2"
    >
      {title}
    </Text>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View className="bg-surface border border-line/40 rounded-2xl mx-4 overflow-hidden">
      {children}
    </View>
  )
}

function RowDivider() {
  return <View className="h-px bg-line/30 ml-[60px] mr-4" />
}

type RowProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"]
  iconColor?: string
  iconBg?: string
  label: string
  value?: string
  onPress?: () => void
  destructive?: boolean
}

function Row({ icon, iconColor = "#A1A1AE", iconBg = "#252529", label, value, onPress, destructive = false }: RowProps) {
  const inner = (
    <View className="flex-row items-center px-4 py-3.5 gap-3">
      <View style={{ backgroundColor: iconBg }} className="w-8 h-8 rounded-lg items-center justify-center" importantForAccessibility="no" accessibilityElementsHidden>
        <Ionicons name={icon} size={16} color={iconColor} importantForAccessibility="no" />
      </View>
      <Text className={`flex-1 text-sm font-medium ${destructive ? "text-red-400" : "text-ink"}`}>
        {label}
      </Text>
      {value
        ? <Text className="text-sm text-ink-muted">{value}</Text>
        : onPress && !destructive
          ? <Ionicons name="chevron-forward" size={16} color="#6B6B7B" importantForAccessibility="no" />
          : null}
    </View>
  )

  if (!onPress) return inner
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} className="active:opacity-70">
      {inner}
    </Pressable>
  )
}

// ─── Dev-only view switcher ───────────────────────────────────────────────────

type ViewOption = {
  view: ActiveView
  label: string
  icon: React.ComponentProps<typeof Ionicons>["name"]
  description: string
}

const VIEW_OPTIONS: ViewOption[] = [
  { view: "MANAGER", label: "Manager", icon: "briefcase", description: "Schedule staff, approve requests, manage team" },
  { view: "EMPLOYEE", label: "Employee", icon: "person", description: "View shifts, submit availability, clock in/out" },
]

function DevViewSwitcher() {
  const { activeView, setActiveView } = useAuthStore()

  async function handleSelect(view: ActiveView) {
    if (view === activeView) return
    void Haptics.selectionAsync()
    await setActiveView(view)
  }

  return (
    <View className="mx-4 gap-2">
      {VIEW_OPTIONS.map((opt) => {
        const active = activeView === opt.view
        return (
          <Pressable
            key={opt.view}
            onPress={() => void handleSelect(opt.view)}
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${opt.label} view`}
            accessibilityState={{ selected: active }}
            className="active:opacity-80"
          >
            <View
              style={{
                borderWidth: active ? 1.5 : 1,
                borderColor: active ? "#F59E0B" : "rgba(245,158,11,0.15)",
                backgroundColor: active ? "rgba(245,158,11,0.08)" : "#1C1C22",
                borderRadius: 14,
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: active ? "rgba(245,158,11,0.15)" : "#252529",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={opt.icon} size={18} color={active ? "#F59E0B" : "#6B6B7B"} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: active ? "#FCD34D" : "#9898A8", marginBottom: 1 }}>
                  {opt.label}
                </Text>
                <Text style={{ fontSize: 11, color: active ? "#A1A1AE" : "#6B6B7B" }}>
                  {opt.description}
                </Text>
              </View>
              {active && (
                <View importantForAccessibility="no" accessibilityElementsHidden style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#F59E0B", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="checkmark" size={12} color="#000" importantForAccessibility="no" />
                </View>
              )}
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { signOut, employee, role, orgId } = useAuthStore()
  const version = Constants.expoConfig?.version ?? "—"
  const canSwitchView = role === "MANAGER" || role === "ADMIN"
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

  function handleSignOut() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    Alert.alert(
      "Sign out",
      "You will need to sign in again to access the app.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => void signOut() },
      ],
    )
  }

  function handleDeleteAccount() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    const canManage = role === "MANAGER" || role === "ADMIN"
    const message = canManage
      ? "This permanently deletes your account. Any workspace you're the only manager of — including all staff, schedules and shifts — is deleted too, and billing stops. This can't be undone."
      : "This permanently deletes your account and removes your access. This can't be undone."
    Alert.alert(
      "Delete account",
      message,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void confirmDeleteAccount(),
        },
      ],
    )
  }

  async function confirmDeleteAccount() {
    setIsDeletingAccount(true)
    try {
      await apiClient.del("/api/me/account")
      // 200 { deleted: true } — sign out and let AuthGate redirect to login
      await signOut()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Sole-manager block: the server error message already names the org(s)
        // and tells the user what to do.
        Alert.alert("Cannot delete account", err.message)
      } else {
        Alert.alert(
          "Something went wrong",
          "Could not delete your account. Please try again later.",
        )
      }
    } finally {
      setIsDeletingAccount(false)
    }
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-base">
      <View className="px-4 pt-4 pb-2">
        <Text className="text-2xl font-bold text-ink">Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Account */}
        <SectionHeader title="Account" />
        <Card>
          <Row icon="person-outline" iconBg="#1C2A3A" iconColor="#60A5FA" label="Name" value={employee?.name ?? "—"} />
          <RowDivider />
          <Row icon="mail-outline" iconBg="#1C2A3A" iconColor="#60A5FA" label="Email" value={employee?.email ?? "—"} />
          <RowDivider />
          <Row
            icon="shield-checkmark-outline"
            iconBg="#1A2A1A"
            iconColor="#30D158"
            label="Account role"
            value={role === "ADMIN" ? "Admin" : role === "MANAGER" ? "Manager" : "Employee"}
          />
          <RowDivider />
          <Row icon="business-outline" iconBg="#1C2A3A" iconColor="#60A5FA" label="Org ID" value={orgId ? `${orgId.slice(0, 8)}…` : "—"} />
        </Card>

        {/* Dev-only view switcher — only rendered for manager accounts */}
        {canSwitchView && (
          <>
            <SectionHeader title="Developer — UI preview" color="#D97706" />
            <View className="mx-4 mb-2 px-3 py-2 rounded-xl" style={{ backgroundColor: "rgba(245,158,11,0.07)", borderWidth: 1, borderColor: "rgba(245,158,11,0.2)" }}>
              <Text style={{ fontSize: 11, color: "#D97706", lineHeight: 16 }}>
                Temporary testing feature. Switches the UI between manager and employee layouts without changing your real account permissions. All backend checks still use your actual role.
              </Text>
            </View>
            <DevViewSwitcher />
          </>
        )}

        {/* Security */}
        <SectionHeader title="Security" />
        <Card>
          <Row icon="log-out-outline" iconColor="#FF453A" iconBg="#2A1515" label="Sign out" onPress={handleSignOut} destructive />
        </Card>

        {/* Danger zone */}
        <SectionHeader title="Danger zone" color="#FF453A" />
        <Card>
          <Row
            icon="trash-outline"
            iconColor="#FF453A"
            iconBg="#2A1515"
            label={isDeletingAccount ? "Deleting…" : "Delete account"}
            onPress={isDeletingAccount ? undefined : handleDeleteAccount}
            destructive
          />
        </Card>

        {/* App */}
        <SectionHeader title="App" />
        <Card>
          <Row icon="information-circle-outline" label="Version" value={version} />
        </Card>

      </ScrollView>
    </SafeAreaView>
  )
}
