"use client"

import { useState } from "react"
import { Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import { getOrgSettings, updateOrgSettings, SUPPORTED_CURRENCIES } from "@/lib/orgSettings"
import { toast } from "sonner"
import { useOrg } from "@/lib/orgContext"
import { SettingsSection } from "./SettingsSection"

export function CurrencySection() {
  const { orgId } = useOrg()
  const [currency, setCurrency] = useState<string>(() => getOrgSettings().currency)
  const [converting, setConverting] = useState(false)

  async function handleSetCurrency(code: string) {
    if (code === currency || converting) return
    const prev = currency
    const name = SUPPORTED_CURRENCIES.find((c) => c.code === code)?.name ?? code
    setCurrency(code)
    setConverting(true)
    try {
      const r = await fetch(`/api/orgs/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: code }),
      })
      if (!r.ok) {
        const data = await r.json() as { error?: string }
        throw new Error(data.error ?? "Failed")
      }
      updateOrgSettings({ currency: code })
      toast.success(`Wages converted to ${name}`)
    } catch (err) {
      setCurrency(prev)
      toast.error(err instanceof Error ? err.message : "Currency conversion failed")
    } finally {
      setConverting(false)
    }
  }

  return (
    <SettingsSection icon={Globe} title="Currency" description="Currency shown on wages and labour costs.">
      <div className="mt-4 flex flex-wrap gap-2">
        {SUPPORTED_CURRENCIES.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => handleSetCurrency(c.code)}
            disabled={converting}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
              currency === c.code
                ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:text-gray-200"
            )}
          >
            {converting && currency === c.code ? (
              <span className="size-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <span className="font-mono text-xs opacity-70">{c.code}</span>
            )}
            {c.name}
          </button>
        ))}
      </div>
      {converting && (
        <p className="mt-2 text-xs text-gray-500">Converting wages at today&apos;s exchange rate…</p>
      )}
    </SettingsSection>
  )
}
