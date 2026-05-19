"use client"

import { Building2, Users, Globe } from "lucide-react"
import { StoreHoursSection } from "@/components/manager/settings/StoreHoursSection"
import { ShiftTypesSection } from "@/components/manager/settings/ShiftTypesSection"
import { TeamAccessSection } from "@/components/manager/settings/TeamAccessSection"
import { ScheduleViewSection } from "@/components/manager/settings/ScheduleViewSection"
import { CurrencySection } from "@/components/manager/settings/CurrencySection"
import { DataRetentionSection } from "@/components/manager/settings/DataRetentionSection"
import { FeaturesSection } from "@/components/manager/settings/FeaturesSection"

const COMING_SOON = [
  {
    icon: Building2,
    title: "Organization",
    description: "Name, logo, and contact details for your business.",
  },
  {
    icon: Users,
    title: "Roles & Permissions",
    description: "Define job roles and what managers can do.",
  },
  {
    icon: Globe,
    title: "Locale & Time Zone",
    description: "Set the time zone and week start day for your schedules.",
  },
]

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

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 md:px-6 py-6 pb-20 md:pb-6">
        <StoreHoursSection />
        <ShiftTypesSection />
        <TeamAccessSection />
        <ScheduleViewSection />
        <CurrencySection />
        <DataRetentionSection />
        <FeaturesSection />

        <div className="space-y-3">
          {COMING_SOON.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex items-start gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-4"
            >
              <div className="mt-0.5 size-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                <Icon className="size-4 text-gray-500 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">{title}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
              </div>
              <span className="ml-auto shrink-0 text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full self-center">
                Coming soon
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
