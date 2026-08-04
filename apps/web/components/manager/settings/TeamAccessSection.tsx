"use client"

import { useState, useEffect } from "react"
import { ShieldCheck, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { useOrg } from "@/lib/orgContext"
import { SettingsSection } from "./SettingsSection"

type TeamMember = {
  userId: string
  name: string | null
  email: string | null
  role: string
}

export function TeamAccessSection() {
  const tToast = useTranslations("manager.toasts")
  const { orgId } = useOrg()
  const [team, setTeam] = useState<TeamMember[]>([])
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    fetch(`/api/orgs/${orgId}/team`)
      .then((r) => r.json())
      .then((d: { data?: TeamMember[] }) => { if (d.data) setTeam(d.data) })
      .catch(() => {})
  }, [orgId])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const r = await fetch(`/api/orgs/${orgId}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
      const data = await r.json() as { data?: TeamMember; error?: string }
      if (!r.ok) throw new Error(data.error ?? "Failed to grant access")
      setTeam((prev) => [...prev, data.data!])
      setInviteEmail("")
      toast.success(`Manager access granted to ${data.data!.email}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to grant access")
    } finally {
      setInviting(false)
    }
  }

  async function handleRevoke(member: TeamMember) {
    setTeam((prev) => prev.filter((m) => m.userId !== member.userId))
    try {
      const r = await fetch(`/api/orgs/${orgId}/team/${member.userId}`, { method: "DELETE" })
      if (!r.ok) {
        setTeam((prev) => [...prev, member])
        toast.error(tToast("accessRevokeFailed"))
      } else {
        toast.success(`Manager access removed for ${member.email}`)
      }
    } catch {
      setTeam((prev) => [...prev, member])
      toast.error(tToast("accessRevokeFailed"))
    }
  }

  return (
    <SettingsSection icon={ShieldCheck} title="Team Access" description="People who can manage schedules and employees.">
      <div className="mt-4 space-y-4">
        {team.length > 0 && (
          <div className="space-y-1">
            {team.map((member) => (
              <div key={member.userId} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/40">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{member.name ?? member.email}</span>
                  {member.name && (
                    <span className="text-sm text-gray-400 ml-2">{member.email}</span>
                  )}
                </div>
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full shrink-0",
                  member.role === "ADMIN"
                    ? "bg-purple-50 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
                    : "bg-blue-50 text-blue-700 dark:bg-gray-700/60 dark:text-gray-200"
                )}>
                  {member.role === "ADMIN" ? "Admin" : "Manager"}
                </span>
                {member.role !== "ADMIN" && (
                  <Tooltip content="Remove manager access">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRevoke(member)}
                      className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-950/40 shrink-0"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </Tooltip>
                )}
              </div>
            ))}
          </div>
        )}

        <div>
          <form onSubmit={handleInvite} className="flex gap-2">
            <Input
              type="email"
              placeholder="colleague@email.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="h-8 text-sm flex-1"
            />
            <Button
              type="submit"
              size="sm"
              disabled={inviting || !inviteEmail.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
            >
              <Plus className="size-3.5 mr-1" />
              {inviting ? "Adding…" : "Grant access"}
            </Button>
          </form>
          <p className="text-xs text-gray-400 mt-2">
            They must already have an account. Access lets them view and edit the schedule.
          </p>
        </div>
      </div>
    </SettingsSection>
  )
}
