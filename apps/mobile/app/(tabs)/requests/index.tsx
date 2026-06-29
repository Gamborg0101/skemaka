import { useState, useRef } from "react"
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  type TextInput as TextInputType,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import { Screen } from "@/components/layout/Screen"
import { LoadingState } from "@/components/feedback/LoadingState"
import { ErrorState } from "@/components/feedback/ErrorState"
import { EmptyState } from "@/components/feedback/EmptyState"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { RefreshButton } from "@/components/ui/RefreshButton"
import { useMyTimeOff, useSubmitTimeOff, useAllTimeOff, useReviewTimeOff } from "@/hooks/useTimeOff"
import { useAuthStore } from "@/store/authStore"
import { formatDateLong } from "@/lib/utils"
import type { TimeOffRequest } from "@skemaka/types"

const ISO_DATE_RE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/

function validateDates(start: string, end: string): string | null {
  if (!ISO_DATE_RE.test(start)) return "Start date must be YYYY-MM-DD (e.g. 2025-07-14)."
  if (!ISO_DATE_RE.test(end))   return "End date must be YYYY-MM-DD."
  if (end < start)              return "End date must be on or after start date."
  return null
}

// ─── Shared card ──────────────────────────────────────────────────────────────

function RequestCard({ item }: { item: TimeOffRequest }) {
  return (
    <Card elevation="flat" className="gap-2">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-semibold text-ink">
            {formatDateLong(item.startDate)}
            {item.startDate !== item.endDate ? ` – ${formatDateLong(item.endDate)}` : ""}
          </Text>
          {item.reason ? (
            <Text className="text-sm text-ink-secondary" numberOfLines={2}>{item.reason}</Text>
          ) : null}
        </View>
        <Badge status={item.status} size="sm" />
      </View>
    </Card>
  )
}

// ─── Manager view ─────────────────────────────────────────────────────────────

function ManagerTimeOffView() {
  const { data: requests = [], isLoading, isError, isFetching, refetch } = useAllTimeOff()
  const review = useReviewTimeOff()

  if (isLoading) return <LoadingState label="Loading requests…" />
  if (isError)   return <ErrorState onRetry={() => void refetch()} />

  const pending  = requests.filter((r) => r.status === "PENDING")
  const resolved = requests.filter((r) => r.status !== "PENDING")

  function handleReview(item: TimeOffRequest, status: "APPROVED" | "DENIED") {
    void Haptics.selectionAsync()
    const label = status === "APPROVED" ? "Approve" : "Deny"
    Alert.alert(
      `${label} request?`,
      `${item.startDate !== item.endDate ? `${formatDateLong(item.startDate)} – ${formatDateLong(item.endDate)}` : formatDateLong(item.startDate)}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: label,
          style: status === "DENIED" ? "destructive" : "default",
          onPress: () =>
            review.mutate(
              { requestId: item.id, status },
              { onError: () => Alert.alert("Error", "Could not update request. Please try again.") },
            ),
        },
      ],
    )
  }

  const allItems: Array<TimeOffRequest | { _section: string }> = [
    ...(pending.length  > 0 ? [{ _section: "Pending" } as const,  ...pending]  : []),
    ...(resolved.length > 0 ? [{ _section: "Resolved" } as const, ...resolved] : []),
  ]

  return (
    <Screen padded={false} edges={["top"]}>
      <FlatList
        data={allItems}
        keyExtractor={(item) => ("_section" in item ? `section-${item._section}` : item.id)}
        contentContainerClassName="px-4 pt-4 pb-8 gap-2"
        onRefresh={() => void refetch()}
        refreshing={isFetching && !isLoading}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View className="mb-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-ink">Time Off</Text>
              <RefreshButton onPress={() => void refetch()} isRefreshing={isFetching && !isLoading} />
            </View>
            <Text className="text-sm text-ink-secondary mt-0.5">
              {pending.length > 0
                ? `${pending.length} pending review`
                : "No pending requests"}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="🌴"
            title="No requests yet"
            description="Employees can request time off from the app."
          />
        }
        renderItem={({ item }) => {
          if ("_section" in item) {
            return (
              <Text className="text-xs font-semibold text-ink-muted uppercase tracking-widest pt-3 pb-1">
                {item._section}
              </Text>
            )
          }

          const isPending = item.status === "PENDING"

          return (
            <View className="bg-surface border border-line/60 rounded-2xl px-4 py-4 gap-3">
              {/* Header row */}
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-semibold text-ink">
                    {formatDateLong(item.startDate)}
                    {item.startDate !== item.endDate ? ` – ${formatDateLong(item.endDate)}` : ""}
                  </Text>
                  {item.reason ? (
                    <Text className="text-sm text-ink-secondary" numberOfLines={2}>
                      {item.reason}
                    </Text>
                  ) : null}
                </View>
                <Badge status={item.status} size="sm" />
              </View>

              {/* Approve / Deny buttons — only for pending */}
              {isPending && (
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => handleReview(item, "APPROVED")}
                    disabled={review.isPending}
                    accessibilityRole="button"
                    accessibilityLabel={`Approve time-off request from ${formatDateLong(item.startDate)}${item.startDate !== item.endDate ? ` to ${formatDateLong(item.endDate)}` : ""}`}
                    accessibilityState={{ disabled: review.isPending }}
                    className="flex-1 flex-row items-center justify-center gap-1.5 py-2 rounded-xl active:opacity-70"
                    style={{ backgroundColor: "rgba(48,209,88,0.12)", borderWidth: 1, borderColor: "rgba(48,209,88,0.25)" }}
                  >
                    <Ionicons name="checkmark" size={14} color="#30D158" importantForAccessibility="no" />
                    <Text className="text-sm font-semibold" style={{ color: "#30D158" }}>Approve</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleReview(item, "DENIED")}
                    disabled={review.isPending}
                    accessibilityRole="button"
                    accessibilityLabel={`Deny time-off request from ${formatDateLong(item.startDate)}${item.startDate !== item.endDate ? ` to ${formatDateLong(item.endDate)}` : ""}`}
                    accessibilityState={{ disabled: review.isPending }}
                    className="flex-1 flex-row items-center justify-center gap-1.5 py-2 rounded-xl active:opacity-70"
                    style={{ backgroundColor: "rgba(255,69,58,0.1)", borderWidth: 1, borderColor: "rgba(255,69,58,0.2)" }}
                  >
                    <Ionicons name="close" size={14} color="#FF453A" importantForAccessibility="no" />
                    <Text className="text-sm font-semibold" style={{ color: "#FF453A" }}>Deny</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )
        }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </Screen>
  )
}

// ─── Employee view ────────────────────────────────────────────────────────────

type FormState = { startDate: string; endDate: string; reason: string }

function EmployeeTimeOffView() {
  const { data: requests, isLoading, isError, isFetching, refetch } = useMyTimeOff()
  const submit = useSubmitTimeOff()
  const reduceMotion = useReducedMotion()

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormState>({ startDate: "", endDate: "", reason: "" })
  const [formError, setFormError] = useState<string | null>(null)

  const endDateRef = useRef<TextInputType>(null)
  const reasonRef  = useRef<TextInputType>(null)

  if (isLoading) return <LoadingState label="Loading requests…" />
  if (isError)   return <ErrorState onRetry={() => void refetch()} />

  function openModal() {
    setForm({ startDate: "", endDate: "", reason: "" })
    setFormError(null)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setFormError(null)
  }

  function handleSubmit() {
    const err = validateDates(form.startDate, form.endDate)
    if (err) { setFormError(err); return }

    submit.mutate(
      { startDate: form.startDate, endDate: form.endDate, reason: form.reason || undefined },
      {
        onSuccess: closeModal,
        onError: () => setFormError("Could not submit request. Please try again."),
      },
    )
  }

  return (
    <Screen padded={false} edges={["top"]}>
      <FlatList
        data={requests ?? []}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pt-4 pb-8 gap-3"
        onRefresh={() => void refetch()}
        refreshing={isFetching && !isLoading}
        ListHeaderComponent={
          <View className="flex-row items-center justify-between mb-1">
            <View>
              <Text className="text-2xl font-bold text-ink">Time Off</Text>
              <Text className="text-sm text-ink-secondary mt-0.5">Your requests</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <RefreshButton onPress={() => void refetch()} isRefreshing={isFetching && !isLoading} />
              <Button
                variant="primary"
                size="sm"
                onPress={openModal}
                accessibilityLabel="Request time off"
              >
                + Request
              </Button>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="🌴"
            title="No requests yet"
            description="Tap the button above to request time off."
          />
        }
        renderItem={({ item }) => <RequestCard item={item} />}
        ItemSeparatorComponent={() => <View className="h-2" />}
        showsVerticalScrollIndicator={false}
      />

      <Modal
        visible={showModal}
        animationType={reduceMotion ? "fade" : "slide"}
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 bg-surface"
        >
          <View className="flex-1 px-6 pt-6 pb-10">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-ink">New Request</Text>
              <Pressable
                onPress={closeModal}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                className="px-3 py-2 active:opacity-60"
              >
                <Text className="text-sm text-ink-secondary">Cancel</Text>
              </Pressable>
            </View>

            <View className="gap-5">
              {formError ? (
                <View className="bg-danger/10 border border-danger/20 rounded-xl px-4 py-3">
                  <Text className="text-sm text-danger">{formError}</Text>
                </View>
              ) : null}

              <View className="gap-1.5">
                <Text className="text-sm font-medium text-ink-secondary">Start Date</Text>
                <TextInput
                  className="bg-elevated border border-line rounded-xl px-4 py-3 text-ink text-sm"
                  placeholder="2025-07-14"
                  placeholderTextColor="#4A4A57"
                  value={form.startDate}
                  onChangeText={(v) => { setFormError(null); setForm((f) => ({ ...f, startDate: v })) }}
                  keyboardType="numbers-and-punctuation"
                  keyboardAppearance="dark"
                  returnKeyType="next"
                  selectionColor="#7B6EF8"
                  onSubmitEditing={() => endDateRef.current?.focus()}
                  blurOnSubmit={false}
                  accessibilityLabel="Start date in YYYY-MM-DD format"
                />
              </View>

              <View className="gap-1.5">
                <Text className="text-sm font-medium text-ink-secondary">End Date</Text>
                <TextInput
                  ref={endDateRef}
                  className="bg-elevated border border-line rounded-xl px-4 py-3 text-ink text-sm"
                  placeholder="2025-07-18"
                  placeholderTextColor="#4A4A57"
                  value={form.endDate}
                  onChangeText={(v) => { setFormError(null); setForm((f) => ({ ...f, endDate: v })) }}
                  keyboardType="numbers-and-punctuation"
                  keyboardAppearance="dark"
                  returnKeyType="next"
                  selectionColor="#7B6EF8"
                  onSubmitEditing={() => reasonRef.current?.focus()}
                  blurOnSubmit={false}
                  accessibilityLabel="End date in YYYY-MM-DD format"
                />
              </View>

              <View className="gap-1.5">
                <Text className="text-sm font-medium text-ink-secondary">
                  Reason{" "}
                  <Text className="font-normal text-ink-muted">(optional)</Text>
                </Text>
                <TextInput
                  ref={reasonRef}
                  className="bg-elevated border border-line rounded-xl px-4 py-3 text-ink text-sm"
                  placeholder="e.g. Vacation, medical, family"
                  placeholderTextColor="#4A4A57"
                  value={form.reason}
                  onChangeText={(v) => setForm((f) => ({ ...f, reason: v }))}
                  keyboardAppearance="dark"
                  returnKeyType="done"
                  selectionColor="#7B6EF8"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  style={{ minHeight: 80 }}
                  accessibilityLabel="Reason for time off, optional"
                />
              </View>

              <Button
                variant="primary"
                fullWidth
                loading={submit.isPending}
                accessibilityLabel="Submit time-off request"
                onPress={handleSubmit}
              >
                Submit Request
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RequestsScreen() {
  const { activeView } = useAuthStore()
  return activeView === "MANAGER"
    ? <ManagerTimeOffView />
    : <EmployeeTimeOffView />
}
