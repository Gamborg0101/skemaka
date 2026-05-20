import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { useState, useEffect } from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import type { Shift, Employee } from "@skemaka/types"
import type { ShiftInput } from "@skemaka/api"
import { formatTime } from "@/lib/utils"

// ─── Time slots ───────────────────────────────────────────────────────────────

const TIME_SLOTS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? "00" : "30"
  return `${String(h).padStart(2, "0")}:${m}`
})

// ─── Types ────────────────────────────────────────────────────────────────────

type SheetView = "form" | "employee" | "time-start" | "time-end"

export type ShiftFormSheetProps = {
  visible: boolean
  date: string
  shift: Shift | null
  employees: Employee[]
  isSaving: boolean
  onSave: (input: ShiftInput) => void
  onDelete?: () => void
  onClose: () => void
  /** Pre-fills a new-shift form (ignored when editing an existing shift). */
  defaultValues?: {
    employeeId?: string
    startTime?: string
    endTime?: string
  }
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

function DragHandle() {
  return (
    <View className="items-center pt-3 pb-1">
      <View className="w-10 h-1 rounded-full bg-line" />
    </View>
  )
}

function SheetHeader({
  title,
  onBack,
  onClose,
}: {
  title: string
  onBack?: () => void
  onClose: () => void
}) {
  return (
    <View className="flex-row items-center px-4 py-3 border-b border-line/40">
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={8}
          className="w-8 h-8 items-center justify-center active:opacity-60"
        >
          <Ionicons name="chevron-back" size={20} color="#7B6EF8" />
        </Pressable>
      ) : (
        <View className="w-8" />
      )}
      <Text className="flex-1 text-center text-base font-semibold text-ink">{title}</Text>
      <Pressable
        onPress={onClose}
        hitSlop={8}
        className="w-8 h-8 items-center justify-center active:opacity-60"
      >
        <Ionicons name="close" size={20} color="#A1A1AE" />
      </Pressable>
    </View>
  )
}

function FieldRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <View className="flex-row items-center min-h-[52px] px-4 border-b border-line/30">
      <Text className="w-28 text-sm text-ink-secondary">{label}</Text>
      <View className="flex-1">{children}</View>
    </View>
  )
}

function SelectButton({
  value,
  placeholder,
  onPress,
}: {
  value: string
  placeholder: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between py-1 active:opacity-60"
    >
      <Text className={`text-sm ${value ? "text-ink font-medium" : "text-ink-muted"}`}>
        {value || placeholder}
      </Text>
      <Ionicons name="chevron-forward" size={14} color="#4A4A57" />
    </Pressable>
  )
}

// ─── Employee picker helpers ──────────────────────────────────────────────────

const PICKER_PALETTE = ["#7B6EF8", "#30D158", "#FF9F0A", "#FF375F", "#32D7FF", "#0A84FF"]

function pickerAvatarColor(name: string): string {
  const hash = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return PICKER_PALETTE[hash % PICKER_PALETTE.length]
}

function pickerInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("")
}

const EMPLOYMENT_LABELS: Record<string, string> = {
  FULL_TIME: "Full-time",
  REDUCED_FULL_TIME: "Reduced",
  PART_TIME: "Part-time",
}

// ─── Employee picker view ─────────────────────────────────────────────────────

function EmployeePickerView({
  employees,
  selectedId,
  onSelect,
  onBack,
  onClose,
}: {
  employees: Employee[]
  selectedId: string
  onSelect: (employee: Employee) => void
  onBack: () => void
  onClose: () => void
}) {
  const [query, setQuery] = useState("")

  const filtered = query.trim()
    ? employees.filter(
        (e) =>
          e.name.toLowerCase().includes(query.toLowerCase()) ||
          e.jobRole.toLowerCase().includes(query.toLowerCase()),
      )
    : employees

  return (
    <>
      <SheetHeader title="Select Employee" onBack={onBack} onClose={onClose} />
      <View className="px-4 py-3 border-b border-line/30">
        <View className="flex-row items-center bg-elevated rounded-xl px-3 h-10 gap-2">
          <Ionicons name="search" size={16} color="#A1A1AE" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search employees…"
            placeholderTextColor="#4A4A57"
            className="flex-1 text-sm text-ink"
            autoFocus
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={6}>
              <Ionicons name="close-circle" size={16} color="#4A4A57" />
            </Pressable>
          ) : null}
        </View>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        renderItem={({ item }) => {
          const isSelected = item.id === selectedId
          const color = pickerAvatarColor(item.name)
          const inits = pickerInitials(item.name)
          const employmentLabel = EMPLOYMENT_LABELS[item.employmentType] ?? item.employmentType
          return (
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync()
                onSelect(item)
              }}
              className="flex-row items-center justify-between px-4 py-3.5 border-b border-line/20 active:bg-elevated"
            >
              <View className="flex-row items-center gap-3 flex-1">
                {/* Avatar */}
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: color + "26",
                    borderWidth: 1.5,
                    borderColor: color + "4D",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color, fontSize: 13, fontWeight: "700" }}>{inits}</Text>
                </View>

                {/* 3-level text hierarchy */}
                <View className="flex-1 gap-0.5">
                  <Text className="text-[15px] font-semibold text-ink" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="text-sm text-ink-secondary" numberOfLines={1}>
                    {item.jobRole}
                  </Text>
                  <Text className="text-xs text-ink-muted">
                    {employmentLabel} · {item.contractedHours}h/week
                  </Text>
                </View>
              </View>
              {isSelected && <Ionicons name="checkmark-circle" size={20} color="#7B6EF8" />}
            </Pressable>
          )
        }}
        ListEmptyComponent={
          <View className="py-12 items-center">
            <Text className="text-sm text-ink-muted">No employees found</Text>
          </View>
        }
      />
    </>
  )
}

// ─── Time picker view ─────────────────────────────────────────────────────────

function TimePickerView({
  title,
  selected,
  onSelect,
  onBack,
  onClose,
}: {
  title: string
  selected: string
  onSelect: (time: string) => void
  onBack: () => void
  onClose: () => void
}) {
  const initialIndex = Math.max(0, TIME_SLOTS.indexOf(selected))

  return (
    <>
      <SheetHeader title={title} onBack={onBack} onClose={onClose} />
      <FlatList
        data={TIME_SLOTS}
        keyExtractor={(t) => t}
        showsVerticalScrollIndicator={false}
        initialScrollIndex={Math.max(0, initialIndex - 3)}
        getItemLayout={(_, index) => ({ length: 52, offset: 52 * index, index })}
        renderItem={({ item }) => {
          const isSelected = item === selected
          return (
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync()
                onSelect(item)
              }}
              className={`px-6 h-[52px] justify-center border-b border-line/20 active:bg-elevated ${
                isSelected ? "bg-brand/10" : ""
              }`}
            >
              <Text
                className={`text-base ${isSelected ? "font-bold text-brand" : "text-ink"}`}
              >
                {formatTime(item)}
              </Text>
            </Pressable>
          )
        }}
      />
    </>
  )
}

// ─── Main form view ───────────────────────────────────────────────────────────

function FormView({
  date,
  shift,
  employees,
  isSaving,
  onNavigate,
  onSave,
  onDelete,
  onClose,
  formState,
  setFormState,
}: {
  date: string
  shift: Shift | null
  employees: Employee[]
  isSaving: boolean
  onNavigate: (view: SheetView) => void
  onSave: (input: ShiftInput) => void
  onDelete?: () => void
  onClose: () => void
  formState: FormState
  setFormState: React.Dispatch<React.SetStateAction<FormState>>
}) {
  const selectedEmployee = employees.find((e) => e.id === formState.employeeId)

  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  function validate(): boolean {
    const errs: typeof errors = {}
    if (!formState.employeeId) errs.employeeId = "Required"
    if (!formState.startTime) errs.startTime = "Required"
    if (!formState.endTime) {
      errs.endTime = "Required"
    } else if (formState.startTime && formState.endTime <= formState.startTime) {
      errs.endTime = "End time must be after start time"
    }
    if (!formState.jobRole.trim()) errs.jobRole = "Required"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSave() {
    if (!validate()) return
    onSave({
      employeeId: formState.employeeId,
      date,
      startTime: formState.startTime,
      endTime: formState.endTime,
      breakMinutes: formState.breakMinutes,
      jobRole: formState.jobRole.trim(),
      notes: formState.notes.trim() || undefined,
    })
  }

  const formattedDate = new Date(date + "T00:00:00Z").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  })

  return (
    <>
      <SheetHeader
        title={shift ? "Edit Shift" : "New Shift"}
        onClose={onClose}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Date (read-only context) */}
        <View className="px-4 py-3 border-b border-line/20">
          <Text className="text-xs text-ink-muted">{formattedDate}</Text>
        </View>

        {/* Employee */}
        <FieldRow label="Employee">
          <View>
            <SelectButton
              value={selectedEmployee?.name ?? ""}
              placeholder="Select employee…"
              onPress={() => onNavigate("employee")}
            />
            {errors.employeeId && (
              <Text className="text-xs text-danger mt-1">{errors.employeeId}</Text>
            )}
          </View>
        </FieldRow>

        {/* Start time */}
        <FieldRow label="Start time">
          <View>
            <SelectButton
              value={formState.startTime ? formatTime(formState.startTime) : ""}
              placeholder="Pick a time…"
              onPress={() => onNavigate("time-start")}
            />
            {errors.startTime && (
              <Text className="text-xs text-danger mt-1">{errors.startTime}</Text>
            )}
          </View>
        </FieldRow>

        {/* End time */}
        <FieldRow label="End time">
          <View>
            <SelectButton
              value={formState.endTime ? formatTime(formState.endTime) : ""}
              placeholder="Pick a time…"
              onPress={() => onNavigate("time-end")}
            />
            {errors.endTime && (
              <Text className="text-xs text-danger mt-1">{errors.endTime}</Text>
            )}
          </View>
        </FieldRow>

        {/* Break */}
        <FieldRow label="Break">
          <View className="flex-row items-center gap-4">
            <Pressable
              hitSlop={8}
              onPress={() =>
                setFormState((s) => ({ ...s, breakMinutes: Math.max(0, s.breakMinutes - 15) }))
              }
              className="w-8 h-8 rounded-lg bg-elevated items-center justify-center active:opacity-60"
            >
              <Ionicons name="remove" size={16} color="#A1A1AE" />
            </Pressable>
            <Text className="text-sm font-semibold text-ink w-16 text-center">
              {formState.breakMinutes === 0 ? "No break" : `${formState.breakMinutes} min`}
            </Text>
            <Pressable
              hitSlop={8}
              onPress={() =>
                setFormState((s) => ({ ...s, breakMinutes: Math.min(120, s.breakMinutes + 15) }))
              }
              className="w-8 h-8 rounded-lg bg-elevated items-center justify-center active:opacity-60"
            >
              <Ionicons name="add" size={16} color="#A1A1AE" />
            </Pressable>
          </View>
        </FieldRow>

        {/* Job role */}
        <FieldRow label="Role">
          <View>
            <TextInput
              value={formState.jobRole}
              onChangeText={(v) => setFormState((s) => ({ ...s, jobRole: v }))}
              placeholder="e.g. Barista"
              placeholderTextColor="#4A4A57"
              className="text-sm text-ink py-1"
              returnKeyType="next"
            />
            {errors.jobRole && (
              <Text className="text-xs text-danger mt-1">{errors.jobRole}</Text>
            )}
          </View>
        </FieldRow>

        {/* Notes */}
        <FieldRow label="Notes">
          <TextInput
            value={formState.notes}
            onChangeText={(v) => setFormState((s) => ({ ...s, notes: v }))}
            placeholder="Optional notes…"
            placeholderTextColor="#4A4A57"
            className="text-sm text-ink py-1"
            multiline
            numberOfLines={2}
            returnKeyType="done"
          />
        </FieldRow>

        {/* Save button */}
        <View className="px-4 mt-6">
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            className="h-14 rounded-2xl bg-brand items-center justify-center active:opacity-80"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-base font-semibold text-white">
                {shift ? "Save Changes" : "Add Shift"}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Delete */}
        {shift && onDelete && (
          <Pressable
            onPress={onDelete}
            disabled={isSaving}
            className="items-center mt-4 py-2 active:opacity-60"
          >
            <Text className="text-sm font-medium text-danger">Delete Shift</Text>
          </Pressable>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </>
  )
}

// ─── Form state ───────────────────────────────────────────────────────────────

type FormState = {
  employeeId: string
  startTime: string
  endTime: string
  breakMinutes: number
  jobRole: string
  notes: string
}

function initialFormState(
  shift: Shift | null,
  defaults?: ShiftFormSheetProps["defaultValues"],
): FormState {
  if (shift) {
    return {
      employeeId: shift.employeeId,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: shift.breakMinutes,
      jobRole: shift.jobRole,
      notes: shift.notes ?? "",
    }
  }
  return {
    employeeId: defaults?.employeeId ?? "",
    startTime:  defaults?.startTime  ?? "09:00",
    endTime:    defaults?.endTime    ?? "17:00",
    breakMinutes: 30,
    jobRole: "",
    notes: "",
  }
}

// ─── Sheet root ───────────────────────────────────────────────────────────────

export function ShiftFormSheet({
  visible,
  date,
  shift,
  employees,
  isSaving,
  onSave,
  onDelete,
  onClose,
  defaultValues,
}: ShiftFormSheetProps) {
  const [view, setView] = useState<SheetView>("form")
  const [formState, setFormState] = useState<FormState>(() => initialFormState(shift, defaultValues))

  // Reset form state whenever the sheet opens with a new shift/date
  useEffect(() => {
    if (visible) {
      setView("form")
      setFormState(initialFormState(shift, defaultValues))
    }
  }, [visible, shift, defaultValues])

  function handleSelectEmployee(employee: Employee) {
    setFormState((s) => ({
      ...s,
      employeeId: employee.id,
      jobRole: s.jobRole || employee.jobRole,
    }))
    setView("form")
  }

  function handleSelectTime(field: "startTime" | "endTime", time: string) {
    setFormState((s) => ({ ...s, [field]: time }))
    setView("form")
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {/* SafeAreaView covers only the bottom — the pageSheet handles top inset. */}
      <SafeAreaView edges={["bottom"]} className="flex-1 bg-base">
        <DragHandle />

        {view === "employee" && (
          <EmployeePickerView
            employees={employees}
            selectedId={formState.employeeId}
            onSelect={handleSelectEmployee}
            onBack={() => setView("form")}
            onClose={onClose}
          />
        )}

        {view === "time-start" && (
          <TimePickerView
            title="Start Time"
            selected={formState.startTime}
            onSelect={(t) => handleSelectTime("startTime", t)}
            onBack={() => setView("form")}
            onClose={onClose}
          />
        )}

        {view === "time-end" && (
          <TimePickerView
            title="End Time"
            selected={formState.endTime}
            onSelect={(t) => handleSelectTime("endTime", t)}
            onBack={() => setView("form")}
            onClose={onClose}
          />
        )}

        {view === "form" && (
          <FormView
            date={date}
            shift={shift}
            employees={employees}
            isSaving={isSaving}
            onNavigate={setView}
            onSave={onSave}
            onDelete={onDelete}
            onClose={onClose}
            formState={formState}
            setFormState={setFormState}
          />
        )}
      </SafeAreaView>
    </Modal>
  )
}
