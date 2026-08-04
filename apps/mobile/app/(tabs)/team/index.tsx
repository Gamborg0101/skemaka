import { useState, useMemo } from "react"
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import { Screen } from "@/components/layout/Screen"
import { EmployeeCardSkeleton } from "@/components/ui/Skeleton"
import { EmptyState } from "@/components/feedback/EmptyState"
import { useOrgEmployees } from "@/hooks/useManagerSchedule"
import type { Employee } from "@skemaka/types"
import { useTranslations } from "@/lib/i18n"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMPLOYMENT_LABELS: Record<string, string> = {
  FULL_TIME: "Full-time",
  REDUCED_FULL_TIME: "Reduced",
  PART_TIME: "Part-time",
}

// Six distinct hues — assigned deterministically by name so each employee
// always gets the same colour across sessions and screens.
const PALETTE = ["#7B6EF8", "#30D158", "#FF9F0A", "#FF375F", "#32D7FF", "#0A84FF"]

function avatarColor(name: string): string {
  const hash = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return PALETTE[hash % PALETTE.length]
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("")
}

function employmentLabel(type: string): string {
  return EMPLOYMENT_LABELS[type] ?? type
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const color = avatarColor(name)
  const inits = initials(name)
  const fontSize = size >= 48 ? 16 : 13

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + "26",
        borderWidth: 1.5,
        borderColor: color + "4D",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color, fontSize, fontWeight: "700" }}>{inits}</Text>
    </View>
  )
}

// ─── Employee card ────────────────────────────────────────────────────────────

function EmployeeCard({
  employee,
  onPress,
}: {
  employee: Employee
  onPress: (e: Employee) => void
}) {
  const label = employmentLabel(employee.employmentType)

  return (
    <Pressable
      onPress={async () => {
        await Haptics.selectionAsync()
        onPress(employee)
      }}
      accessibilityRole="button"
      accessibilityLabel={`View ${employee.name}`}
      className="bg-surface border border-line/60 rounded-2xl px-4 py-4 flex-row items-center gap-4 active:opacity-75"
    >
      {/* Avatar */}
      <Avatar name={employee.name} size={48} />

      {/* Three-level text hierarchy */}
      <View className="flex-1 gap-0.5">
        {/* PRIMARY — name */}
        <Text className="text-[15px] font-semibold text-ink leading-snug">
          {employee.name}
        </Text>

        {/* SECONDARY — role */}
        <Text className="text-sm text-ink-secondary">
          {employee.jobRole}
        </Text>

        {/* TERTIARY — employment type + hours */}
        <Text className="text-xs text-ink-muted mt-0.5">
          {label} · {employee.contractedHours}h/week
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={16} color="#4A4A57" importantForAccessibility="no" />
    </Pressable>
  )
}

// ─── Detail sheet ─────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between px-4 py-4">
      <Text className="text-sm text-ink-secondary">{label}</Text>
      <Text className="text-sm font-medium text-ink flex-1 text-right pl-4">
        {value}
      </Text>
    </View>
  )
}

function EmployeeDetailSheet({
  employee,
  onClose,
}: {
  employee: Employee | null
  onClose: () => void
}) {
  const t = useTranslations("mobile")
  const reduceMotion = useReducedMotion()
  if (!employee) return null

  const label = employmentLabel(employee.employmentType)

  return (
    <Modal
      visible
      animationType={reduceMotion ? "fade" : "slide"}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={["bottom"]} className="flex-1 bg-base">
        {/* Drag handle */}
        <View className="items-center pt-3 pb-1">
          <View className="w-10 h-1 rounded-full bg-line" />
        </View>

        {/* Close button */}
        <View className="flex-row justify-end px-4 pt-2 pb-1">
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            className="w-9 h-9 rounded-xl bg-elevated items-center justify-center active:opacity-60"
          >
            <Ionicons name="close" size={18} color="#A1A1AE" />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          {/* Hero — avatar + name + role */}
          <View className="items-center px-6 pt-4 pb-8 gap-3">
            <Avatar name={employee.name} size={72} />
            <View className="items-center gap-1">
              <Text className="text-xl font-bold text-ink text-center">{employee.name}</Text>
              <Text className="text-sm text-ink-secondary text-center">{employee.jobRole}</Text>
            </View>
          </View>

          {/* Contact */}
          <Text className="text-xs font-semibold text-ink-muted uppercase tracking-widest px-4 mb-2">
            {t("team.contact")}
          </Text>
          <View className="mx-4 bg-surface border border-line/40 rounded-2xl overflow-hidden mb-5">
            <DetailRow label={t("common.email")} value={employee.email} />
            <View className="h-px bg-line/30 mx-4" />
            <DetailRow label={t("common.phone")} value={employee.phone ?? t("common.notSet")} />
          </View>

          {/* Employment */}
          <Text className="text-xs font-semibold text-ink-muted uppercase tracking-widest px-4 mb-2">
            {t("team.employment")}
          </Text>
          <View className="mx-4 bg-surface border border-line/40 rounded-2xl overflow-hidden">
            <DetailRow label={t("team.type")} value={label} />
            <View className="h-px bg-line/30 mx-4" />
            <DetailRow label={t("team.contractedHours")} value={`${employee.contractedHours}h/week`} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

// ─── Search bar ───────────────────────────────────────────────────────────────

function SearchBar({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const t = useTranslations("mobile")
  return (
    <View className="flex-row items-center bg-elevated border border-line/40 rounded-xl px-3 h-11 gap-2">
      <Ionicons name="search" size={16} color="#A1A1AE" importantForAccessibility="no" />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={t("team.searchPlaceholder")}
        placeholderTextColor="#4A4A57"
        className="flex-1 text-sm text-ink"
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChange("")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("common.clearSearch")}
        >
          <Ionicons name="close-circle" size={16} color="#6B6B7B" importantForAccessibility="no" />
        </Pressable>
      )}
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TeamScreen() {
  const t = useTranslations("mobile")
  const { data: employees = [], isLoading, isFetching, refetch } = useOrgEmployees()
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Employee | null>(null)

  const active = useMemo(() => employees.filter((e) => e.isActive), [employees])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return active
    return active.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.jobRole.toLowerCase().includes(q),
    )
  }, [active, query])

  return (
    <Screen scroll={false} padded={false} edges={["top"]}>
      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onRefresh={() => void refetch()}
        refreshing={isFetching && !isLoading}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={
          <View className="pt-4 pb-3 gap-3">
            {/* Page title + count */}
            <View className="flex-row items-baseline justify-between">
              <Text className="text-2xl font-bold text-ink">{t("team.title")}</Text>
              {!isLoading && (
                <Text className="text-sm text-ink-muted">
                  {active.length} {active.length === 1 ? "member" : "members"}
                </Text>
              )}
            </View>

            <SearchBar value={query} onChange={setQuery} />
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View className="gap-3 pt-1">
              {Array.from({ length: 6 }, (_, i) => (
                <EmployeeCardSkeleton key={i} />
              ))}
            </View>
          ) : query.trim() ? (
            <View className="flex-1 items-center justify-center py-16 gap-1">
              <Text className="text-sm text-ink-secondary">No results for &quot;{query}&quot;</Text>
              <Text className="text-xs text-ink-muted">{t("team.noMatch")}</Text>
            </View>
          ) : (
            <EmptyState
              icon="👥"
              title={t("team.empty")}
              description={t("team.emptyHint")}
            />
          )
        }
        renderItem={({ item }) => (
          <EmployeeCard employee={item} onPress={setSelected} />
        )}
      />

      <EmployeeDetailSheet
        employee={selected}
        onClose={() => setSelected(null)}
      />
    </Screen>
  )
}
