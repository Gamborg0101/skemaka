"use client"

import Link from "next/link"
import { Building2, Users, Globe, CreditCard, ChevronRight } from "lucide-react"
import { JobRolesSection } from "@/components/manager/settings/JobRolesSection"
import { StoreHoursSection } from "@/components/manager/settings/StoreHoursSection"
import { ShiftTypesSection } from "@/components/manager/settings/ShiftTypesSection"
import { TeamAccessSection } from "@/components/manager/settings/TeamAccessSection"
import { ScheduleViewSection } from "@/components/manager/settings/ScheduleViewSection"
import { TimeFormatSection } from "@/components/manager/settings/TimeFormatSection"
import { CurrencySection } from "@/components/manager/settings/CurrencySection"
import { DataRetentionSection } from "@/components/manager/settings/DataRetentionSection"
import { FeaturesSection } from "@/components/manager/settings/FeaturesSection"
import { DeleteAccountSection } from "@/components/manager/settings/DeleteAccountSection"
import { SettingsGroup } from "@/components/manager/settings/SettingsGroup"

/** Muted placeholder card for planned settings, shown inside its future group. */
function ComingSoonCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="mb-4 flex items-start gap-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 px-5 py-4">
      <div className="mt-0.5 size-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
        <Icon className="size-4 text-gray-400 dark:text-gray-500" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>
      </div>
      <span className="ml-auto self-center shrink-0 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-400 dark:text-gray-500">
        Coming soon
      </span>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="hidden md:flex items-center gap-3 px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Organization settings</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Manage your workspace configuration.</p>
        </div>
      </div>

      {/* Mobile header */}
      <div className="md:hidden px-4 pt-6 pb-2">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Organization settings</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Manage your workspace configuration.</p>
      </div>

      {/* Content — grouped so sections are easy to find */}
      <div className="flex-1 overflow-auto px-4 md:px-6 py-6 pb-20 md:pb-6">
        <div className="mx-auto max-w-3xl">
          <SettingsGroup title="Scheduling">
            <StoreHoursSection />
            <ShiftTypesSection />
            <ScheduleViewSection />
            <TimeFormatSection />
            <ComingSoonCard
              icon={Globe}
              title="Locale & Time Zone"
              description="Set the time zone and week start day for your schedules."
            />
          </SettingsGroup>

          <SettingsGroup title="Team">
            <JobRolesSection />
            <TeamAccessSection />
            <ComingSoonCard
              icon={Users}
              title="Roles & Permissions"
              description="Define job roles and what managers can do."
            />
          </SettingsGroup>

          <SettingsGroup title="Features">
            <FeaturesSection />
          </SettingsGroup>

          <SettingsGroup title="Workspace">
            <CurrencySection />
            <Link
              href="/billing"
              className="mb-4 flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800/60 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
            >
              <div className="size-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                <CreditCard className="size-4 text-gray-500 dark:text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Billing</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Plan, payment method and invoices.</p>
              </div>
              <ChevronRight className="size-4 text-gray-400 dark:text-gray-500 shrink-0" />
            </Link>
            <ComingSoonCard
              icon={Building2}
              title="Organization"
              description="Name, logo, and contact details for your business."
            />
          </SettingsGroup>

          <SettingsGroup title="Data & account">
            <DataRetentionSection />
            <DeleteAccountSection />
          </SettingsGroup>
        </div>
      </div>
    </div>
  )
}
