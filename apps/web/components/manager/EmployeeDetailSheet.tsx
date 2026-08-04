"use client"

import { useState } from "react"
import {
  Mail,
  Phone,
  Calendar,
  Briefcase,
  Send,
  BadgeCheck,
} from "lucide-react"
import { toast } from "sonner"
import { useLocale, useTranslations } from "next-intl"
import { LOCALE_TAGS, type Locale } from "@skemaka/i18n"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SickDaysSection } from "@/components/manager/SickDaysSection"
import { getInitials } from "@/lib/utils"
import { formatCurrency, getCurrencySymbol, getOrgSettings } from "@/lib/orgSettings"
import { useOrg } from "@/lib/orgContext"
import { isEmploymentType } from "@/types"
import type { Employee, EmploymentType, JobRole } from "@/types"

/** Employment-type label using the org's configured full-time / reduced hours. */
function employmentTypeLabel(
  t: ReturnType<typeof useTranslations<"manager.employment">>,
  type: EmploymentType,
  fullTimeHours: number,
  reducedHours: number,
): string {
  if (type === "FULL_TIME") return t("fullTime", { hours: fullTimeHours })
  if (type === "REDUCED_FULL_TIME") return t("reducedFullTime", { hours: reducedHours })
  return t("partTime")
}

interface EmployeeDetailSheetProps {
  employee: Employee | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (updated: Partial<Employee>) => void
  jobRoles: JobRole[]
  orgId: string
  initialMode?: "view" | "edit"
}

function formatDate(isoDate: string, localeTag: string): string {
  return new Date(isoDate).toLocaleDateString(localeTag, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

// View label reflects the employee's own stored hours (not the org default), so
// it stays accurate even if the org later changes what full-time means.
function formatContractLabel(
  t: ReturnType<typeof useTranslations<"manager.employment">>,
  tDetail: ReturnType<typeof useTranslations<"manager.employeeDetail">>,
  type: EmploymentType,
  contractedHours: number,
): string {
  if (type === "FULL_TIME") return t("fullTime", { hours: contractedHours })
  if (type === "REDUCED_FULL_TIME") return t("reducedFullTime", { hours: contractedHours })
  return tDetail("contractPartTime", { hours: contractedHours })
}

// ── View mode ─────────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-gray-100">
        <Icon className="size-3.5 text-gray-500" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 leading-none mb-0.5">{label}</p>
        <div className="text-sm text-gray-800 dark:text-gray-100">{children}</div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function EmployeeDetailSheet({
  employee,
  open,
  onOpenChange,
  onUpdate,
  jobRoles,
  orgId,
  initialMode = "view",
}: EmployeeDetailSheetProps) {
  const { org } = useOrg()
  const { fullTimeHours, reducedFullTimeHours } = getOrgSettings()
  const t = useTranslations("manager.employeeDetail")
  const tFields = useTranslations("manager.employeeFields")
  const tEmployment = useTranslations("manager.employment")
  const tEmployees = useTranslations("manager.employees")
  const tToasts = useTranslations("manager.toasts")
  const tCommon = useTranslations("common")
  const localeTag = LOCALE_TAGS[useLocale() as Locale]
  const [isEditing, setIsEditing] = useState(initialMode === "edit")
  const [sendingInvite, setSendingInvite] = useState(false)

  async function handleResendInvite() {
    if (!employee) return
    setSendingInvite(true)
    try {
      const r = await fetch(`/api/orgs/${orgId}/employees/${employee.id}/invite`, {
        method: "POST",
      })
      if (!r.ok) throw new Error("Failed")
      toast.success(tToasts("inviteSent", { email: employee.email }))
    } catch {
      toast.error(tToasts("inviteSendFailed"))
    } finally {
      setSendingInvite(false)
    }
  }

  // Edit form state
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editJobRole, setEditJobRole] = useState("")
  const [editHourlyWage, setEditHourlyWage] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [editEmploymentType, setEditEmploymentType] = useState<EmploymentType>("PART_TIME")
  const [editContractedHours, setEditContractedHours] = useState("0")

  // Sync form state when employee changes — adjust state during render pattern.
  // Starts null so a non-null employee at mount also populates the fields
  // (the original effect ran on mount).
  const [prevEmployee, setPrevEmployee] = useState<Employee | null>(null)
  if (employee !== prevEmployee) {
    setPrevEmployee(employee)
    if (employee) {
      setEditName(employee.name)
      setEditEmail(employee.email)
      setEditPhone(employee.phone ?? "")
      setEditJobRole(employee.jobRole)
      setEditHourlyWage(employee.hourlyWage.toString())
      setEditNotes(employee.notes ?? "")
      setEditEmploymentType(employee.employmentType)
      setEditContractedHours(employee.contractedHours.toString())
    }
  }

  // Reset editing mode when sheet opens/mode changes — adjust state during render pattern.
  const openModeKey = `${open ? 1 : 0}__${initialMode}`
  const [prevOpenModeKey, setPrevOpenModeKey] = useState(openModeKey)
  if (openModeKey !== prevOpenModeKey) {
    setPrevOpenModeKey(openModeKey)
    setIsEditing(initialMode === "edit")
  }

  const handleSave = () => {
    if (!employee) return
    const updated: Partial<Employee> = {}

    if (editName.trim() !== employee.name) updated.name = editName.trim()
    if (editEmail.trim() !== employee.email) updated.email = editEmail.trim()
    const newPhone = editPhone.trim() || null
    if (newPhone !== employee.phone) updated.phone = newPhone
    if (editJobRole.trim() !== employee.jobRole) updated.jobRole = editJobRole.trim()
    const newWage = parseFloat(editHourlyWage)
    if (!isNaN(newWage) && newWage !== employee.hourlyWage) updated.hourlyWage = newWage
    const newNotes = editNotes.trim() || null
    if (newNotes !== employee.notes) updated.notes = newNotes
    if (editEmploymentType !== employee.employmentType) updated.employmentType = editEmploymentType
    // Full-time / reduced derive their hours from org settings; only part-time
    // uses the free-text field. This also keeps hours correct when the manager
    // switches an employee's type.
    const newContractedHours =
      editEmploymentType === "FULL_TIME" ? fullTimeHours
      : editEmploymentType === "REDUCED_FULL_TIME" ? reducedFullTimeHours
      : parseInt(editContractedHours, 10) || 0
    if (newContractedHours !== employee.contractedHours) updated.contractedHours = newContractedHours

    if (Object.keys(updated).length > 0) {
      onUpdate(updated)
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    if (employee) {
      setEditName(employee.name)
      setEditEmail(employee.email)
      setEditPhone(employee.phone ?? "")
      setEditJobRole(employee.jobRole)
      setEditHourlyWage(employee.hourlyWage.toString())
      setEditNotes(employee.notes ?? "")
      setEditEmploymentType(employee.employmentType)
      setEditContractedHours(employee.contractedHours.toString())
    }
    setIsEditing(false)
  }

  if (!employee) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] overflow-y-auto p-0 flex flex-col gap-0"
        showCloseButton
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-lg font-semibold select-none">
              {getInitials(employee.name)}
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <SheetTitle className="text-base font-semibold text-gray-900 dark:text-gray-50 leading-tight">
                {employee.name}
              </SheetTitle>
              <p className="text-sm text-gray-500 mt-0.5">{employee.jobRole}</p>
              <div className="mt-2">
                <Badge
                  variant={employee.isActive ? "default" : "secondary"}
                  className={
                    employee.isActive
                      ? "bg-green-100 text-green-700 border-green-200 text-xs"
                      : "text-gray-500 text-xs"
                  }
                >
                  {employee.isActive ? t("active") : t("inactive")}
                </Badge>
              </div>
            </div>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="shrink-0 mr-8"
              >
                {t("editButton")}
              </Button>
            )}
          </div>
        </SheetHeader>

        <Separator />

        {/* Body */}
        <div className="flex-1 px-6 py-5 space-y-5">
          {isEditing ? (
            // ── Edit mode ────────────────────────────────────────────────────
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">{tFields("name")}</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-email">{tFields("email")}</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-phone">{tFields("phoneOptional")}</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  placeholder={tFields("phoneNotSet")}
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-role">{tFields("jobRole")}</Label>
                <Select value={editJobRole} onValueChange={(val) => setEditJobRole(val ?? "")}>
                  <SelectTrigger id="edit-role" className="w-full">
                    <SelectValue placeholder={tFields("jobRolePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {jobRoles.map((r) => (
                      <SelectItem key={r.id} value={r.name}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-wage">{tFields("hourlyWage", { symbol: getCurrencySymbol() })}</Label>
                <Input
                  id="edit-wage"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editHourlyWage}
                  onChange={(e) => setEditHourlyWage(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-employment-type">{tFields("employmentType")}</Label>
                <Select
                  value={editEmploymentType}
                  onValueChange={(val) => { if (val && isEmploymentType(val)) setEditEmploymentType(val) }}
                >
                  <SelectTrigger id="edit-employment-type" className="w-full">
                    <SelectValue>{employmentTypeLabel(tEmployment, editEmploymentType, fullTimeHours, reducedFullTimeHours)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL_TIME">{employmentTypeLabel(tEmployment, "FULL_TIME", fullTimeHours, reducedFullTimeHours)}</SelectItem>
                    <SelectItem value="REDUCED_FULL_TIME">{employmentTypeLabel(tEmployment, "REDUCED_FULL_TIME", fullTimeHours, reducedFullTimeHours)}</SelectItem>
                    <SelectItem value="PART_TIME">{tEmployment("partTime")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editEmploymentType === "PART_TIME" && (
                <div className="space-y-1.5">
                  <Label htmlFor="edit-contracted-hours">{tFields("contractedHours")}</Label>
                  <Input
                    id="edit-contracted-hours"
                    type="number"
                    min="0"
                    max="40"
                    value={editContractedHours}
                    onChange={(e) => setEditContractedHours(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="edit-notes">{tFields("notes")}</Label>
                <Textarea
                  id="edit-notes"
                  placeholder={tFields("notesPlaceholder")}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            </div>
          ) : (
            // ── View mode ────────────────────────────────────────────────────
            <div className="space-y-4">
              <InfoRow icon={Mail} label={tFields("email")}>
                <a
                  href={`mailto:${employee.email}`}
                  className="text-blue-600 hover:underline"
                >
                  {employee.email}
                </a>
              </InfoRow>

              <InfoRow icon={Phone} label={tFields("phone")}>
                {employee.phone ? (
                  <span className="inline-flex items-center gap-1.5">
                    <a href={`tel:${employee.phone}`} className="text-blue-600 hover:underline">
                      {employee.phone}
                    </a>
                    {employee.phoneVerified && (
                      <span
                        title={t("phoneVerifiedTitle")}
                        className="inline-flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700"
                      >
                        <BadgeCheck className="size-3" />
                        {t("phoneVerified")}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-gray-400">{tFields("phoneNotSet")}</span>
                )}
              </InfoRow>

              <InfoRow icon={Briefcase} label={t("hourlyRate")}>
                <span>{formatCurrency(employee.hourlyWage, org?.currency)} {t("perHour")}</span>
              </InfoRow>

              <InfoRow icon={Briefcase} label={t("contract")}>
                <span>{formatContractLabel(tEmployment, t, employee.employmentType, employee.contractedHours)}</span>
              </InfoRow>

              <InfoRow icon={Calendar} label={t("memberSince")}>
                <span>{formatDate(employee.createdAt, localeTag)}</span>
              </InfoRow>

              {employee.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                      {t("notesTitle")}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {employee.notes}
                    </p>
                  </div>
                </>
              )}

              <Separator />

              {/* Sick days — collapsible history (last 6 months by default) */}
              <SickDaysSection orgId={orgId} employeeId={employee.id} />

              {/* Invite — only while the employee hasn't accepted (no linked
                  user account yet). Once accepted, there's nothing to (re)send. */}
              {employee.isActive && !employee.userId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResendInvite}
                  disabled={sendingInvite}
                  className="w-full gap-2"
                >
                  <Send className="size-3.5" />
                  {sendingInvite ? t("sendingInvite") : employee.inviteToken ? tEmployees("resendInviteTooltip") : t("sendInviteEmail")}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Footer — only in edit mode */}
        {isEditing && (
          <>
            <Separator />
            <div className="px-6 py-4 flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancel}>
                {tCommon("cancel")}
              </Button>
              <Button
                onClick={handleSave}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {t("saveChanges")}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
