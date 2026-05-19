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
  type TextInput as TextInputType,
} from "react-native"
import { Screen } from "@/components/layout/Screen"
import { LoadingState } from "@/components/feedback/LoadingState"
import { ErrorState } from "@/components/feedback/ErrorState"
import { EmptyState } from "@/components/feedback/EmptyState"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { useMyTimeOff, useSubmitTimeOff } from "@/hooks/useTimeOff"
import { formatDateLong } from "@/lib/utils"
import type { TimeOffRequest } from "@skemaka/types"

const ISO_DATE_RE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/

function validateDates(start: string, end: string): string | null {
  if (!ISO_DATE_RE.test(start)) return "Start date must be YYYY-MM-DD (e.g. 2025-07-14)."
  if (!ISO_DATE_RE.test(end))   return "End date must be YYYY-MM-DD."
  if (end < start)              return "End date must be on or after start date."
  return null
}

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

type FormState = { startDate: string; endDate: string; reason: string }

export default function RequestsScreen() {
  const { data: requests, isLoading, isError, isFetching, refetch } = useMyTimeOff()
  const submit = useSubmitTimeOff()

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
            <Button
              variant="primary"
              size="sm"
              onPress={openModal}
              accessibilityLabel="Request time off"
            >
              + Request
            </Button>
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
        animationType="slide"
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
