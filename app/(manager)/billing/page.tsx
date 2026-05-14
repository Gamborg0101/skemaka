"use client"

import { CreditCard, Receipt, Zap } from "lucide-react"

export default function BillingPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Billing</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your subscription and payment details.
        </p>
      </div>

      {/* Current plan */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <Zap className="size-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900">Free trial</p>
            <p className="text-sm text-blue-700">Full access during early access — no card required.</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4">
          <div className="mt-0.5 size-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <CreditCard className="size-4 text-gray-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Payment method</p>
            <p className="text-sm text-gray-500 mt-0.5">Add a card to continue after your trial ends.</p>
          </div>
          <span className="ml-auto shrink-0 text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full self-center">
            Coming soon
          </span>
        </div>

        <div className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4">
          <div className="mt-0.5 size-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <Receipt className="size-4 text-gray-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Invoices</p>
            <p className="text-sm text-gray-500 mt-0.5">Download past invoices for your records.</p>
          </div>
          <span className="ml-auto shrink-0 text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full self-center">
            Coming soon
          </span>
        </div>
      </div>
    </div>
  )
}
