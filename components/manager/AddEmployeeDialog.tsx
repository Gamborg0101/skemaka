"use client"

import { useState } from "react"
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
import { getCurrencySymbol } from "@/lib/orgSettings"
import { isEmploymentType } from "@/types"
import type { JobRole, EmploymentType } from "@/types"
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
  }) => void
}

export function AddEmployeeDialog({
  open,
  onOpenChange,
  jobRoles,
  onEmployeeAdd,
}: AddEmployeeDialogProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [jobRole, setJobRole] = useState("")
  const [hourlyWage, setHourlyWage] = useState("")
  const [employmentType, setEmploymentType] = useState<EmploymentType>("PART_TIME")
  const [contractedHours, setContractedHours] = useState("")
  const [notes, setNotes] = useState("")

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

  const resolvedContractedHours = (): number => {
    if (employmentType === "FULL_TIME") return 40
    if (employmentType === "REDUCED_FULL_TIME") return 32
    return parseInt(contractedHours, 10) || 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const partTimeHoursOk = employmentType !== "PART_TIME" || !!contractedHours
    if (!name || !email || !phone || !jobRole || !hourlyWage || !partTimeHoursOk) return

    onEmployeeAdd({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      jobRole: jobRole.trim(),
      hourlyWage: parseFloat(hourlyWage),
      employmentType,
      contractedHours: resolvedContractedHours(),
      notes: notes.trim() || null,
    })

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
          <DialogTitle>Add Employee</DialogTitle>
          <DialogDescription>
            The employee will receive an invite email with a magic link to access their portal.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="emp-name">Name</Label>
            <Input
              id="emp-name"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-email">Email</Label>
            <Input
              id="emp-email"
              type="email"
              placeholder="employee@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-phone">Phone</Label>
            <Input
              id="emp-phone"
              type="tel"
              placeholder="+45 12 34 56 78"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={(e) => setPhone(formatPhoneNumber(e.target.value))}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-role">Job Role</Label>
            <Select value={jobRole} onValueChange={(val) => setJobRole(val ?? "")}>
              <SelectTrigger id="emp-role" className="w-full">
                <SelectValue placeholder="Select a role" />
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
            <Label htmlFor="emp-wage">Hourly Wage ({getCurrencySymbol()})</Label>
            <Input
              id="emp-wage"
              type="number"
              min="0"
              step="0.01"
              placeholder="15.00"
              value={hourlyWage}
              onChange={(e) => setHourlyWage(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-employment-type">Employment Type</Label>
            <Select value={employmentType} onValueChange={(val) => { if (val && isEmploymentType(val)) setEmploymentType(val) }}>
              <SelectTrigger id="emp-employment-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL_TIME">Full Time (40h/week)</SelectItem>
                <SelectItem value="REDUCED_FULL_TIME">Reduced Full Time (32h/week)</SelectItem>
                <SelectItem value="PART_TIME">Part Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {employmentType === "PART_TIME" && (
            <div className="space-y-1.5">
              <Label htmlFor="emp-contracted-hours">Contracted Hours / week</Label>
              <Input
                id="emp-contracted-hours"
                type="number"
                min="1"
                max="39"
                placeholder="20"
                value={contractedHours}
                onChange={(e) => setContractedHours(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="emp-notes">Notes (optional)</Label>
            <Textarea
              id="emp-notes"
              placeholder="Any notes about this employee..."
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
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
              Add &amp; Send Invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
