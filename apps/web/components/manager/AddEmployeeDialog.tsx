"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getCurrencySymbol, getOrgSettings } from "@/lib/orgSettings"
import { isEmploymentType } from "@/types"
import type { JobRole, EmploymentType } from "@/types"

/** Human label for an employment type, using the org's configured full-time hours. */
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
import { parsePhoneNumberWithError, ParseError } from "libphonenumber-js"

function formatPhoneNumber(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed

  // For bare digits with no country code, assume Danish (+45)
  const digits = trimmed.replace(/\D/g, "")
  const input = trimmed.startsWith("+") ? trimmed : `+45${digits}`

  try {
    const parsed = parsePhoneNumberWithError(input)
    if (parsed.isValid()) return parsed.formatInternational()
  } catch (e) {
    if (!(e instanceof ParseError)) throw e
  }

  return trimmed
}

interface AddEmployeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobRoles: JobRole[]
  onEmployeeAdd: (data: {
    name: string
    email: string
    phone: string
    jobRole: string
    hourlyWage: number
    employmentType: EmploymentType
    contractedHours: number
    notes: string | null
  }) => Promise<boolean>
}

export function AddEmployeeDialog({
  open,
  onOpenChange,
  jobRoles,
  onEmployeeAdd,
}: AddEmployeeDialogProps) {
  const t = useTranslations("manager.addEmployeeDialog")
  const tFields = useTranslations("manager.employeeFields")
  const tEmployment = useTranslations("manager.employment")
  const tEmployees = useTranslations("manager.employees")
  const tCommon = useTranslations("common")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [jobRole, setJobRole] = useState("")
  const [hourlyWage, setHourlyWage] = useState("")
  const [employmentType, setEmploymentType] = useState<EmploymentType>("PART_TIME")
  const [contractedHours, setContractedHours] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setName("")
    setEmail("")
    setPhone("")
    setJobRole("")
    setHourlyWage("")
    setEmploymentType("PART_TIME")
    setContractedHours("")
    setNotes("")
  }

  const { fullTimeHours, reducedFullTimeHours } = getOrgSettings()

  const resolvedContractedHours = (): number => {
    if (employmentType === "FULL_TIME") return fullTimeHours
    if (employmentType === "REDUCED_FULL_TIME") return reducedFullTimeHours
    return parseInt(contractedHours, 10) || 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const partTimeHoursOk = employmentType !== "PART_TIME" || !!contractedHours
    // The Select fields (Job Role, contracted hours) have no native browser
    // validation, so a silent early-return leaves the manager confused. Point
    // them at what's missing.
    if (!jobRole) { toast.error(t("pickJobRole")); return }
    if (!partTimeHoursOk) { toast.error(t("setContractedHours")); return }
    if (!name || !email || !phone || !hourlyWage) return
    if (submitting) return

    setSubmitting(true)
    let added = false
    try {
      added = await onEmployeeAdd({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        jobRole: jobRole.trim(),
        hourlyWage: parseFloat(hourlyWage),
        employmentType,
        contractedHours: resolvedContractedHours(),
        notes: notes.trim() || null,
      })
    } finally {
      setSubmitting(false)
    }

    // Only clear and close once the employee actually exists. Closing
    // unconditionally used to throw away everything the manager had typed on a
    // rejected request, leaving a toast as the only trace and a roster that
    // silently did not contain the person they just added.
    if (!added) return
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tEmployees("addEmployee")}</DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="emp-name">{tFields("name")} <span className="text-rose-500">*</span></Label>
            <Input
              id="emp-name"
              placeholder={tFields("namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-email">{tFields("email")} <span className="text-rose-500">*</span></Label>
            <Input
              id="emp-email"
              type="email"
              placeholder={tFields("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-phone">{tFields("phone")} <span className="text-rose-500">*</span></Label>
            <Input
              id="emp-phone"
              type="tel"
              placeholder={tFields("phonePlaceholder")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={(e) => setPhone(formatPhoneNumber(e.target.value))}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-role">{tFields("jobRole")} <span className="text-rose-500">*</span></Label>
            <Select value={jobRole} onValueChange={(val) => setJobRole(val ?? "")}>
              <SelectTrigger id="emp-role" className="w-full">
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
            <Label htmlFor="emp-wage">{tFields("hourlyWage", { symbol: getCurrencySymbol() })} <span className="text-rose-500">*</span></Label>
            <Input
              id="emp-wage"
              type="number"
              min="0"
              step="0.01"
              placeholder={tFields("hourlyWagePlaceholder")}
              value={hourlyWage}
              onChange={(e) => setHourlyWage(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-employment-type">{tFields("employmentType")}</Label>
            <Select value={employmentType} onValueChange={(val) => { if (val && isEmploymentType(val)) setEmploymentType(val) }}>
              <SelectTrigger id="emp-employment-type" className="w-full">
                <SelectValue>{employmentTypeLabel(tEmployment, employmentType, fullTimeHours, reducedFullTimeHours)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL_TIME">{employmentTypeLabel(tEmployment, "FULL_TIME", fullTimeHours, reducedFullTimeHours)}</SelectItem>
                <SelectItem value="REDUCED_FULL_TIME">{employmentTypeLabel(tEmployment, "REDUCED_FULL_TIME", fullTimeHours, reducedFullTimeHours)}</SelectItem>
                <SelectItem value="PART_TIME">{tEmployment("partTime")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {employmentType === "PART_TIME" && (
            <div className="space-y-1.5">
              <Label htmlFor="emp-contracted-hours">{tFields("contractedHours")}</Label>
              <Input
                id="emp-contracted-hours"
                type="number"
                min="1"
                max="39"
                placeholder={tFields("contractedHoursPlaceholder")}
                value={contractedHours}
                onChange={(e) => setContractedHours(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="emp-notes">{tFields("notes")}</Label>
            <Textarea
              id="emp-notes"
              placeholder={tFields("notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-14"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {submitting ? tCommon("adding") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
