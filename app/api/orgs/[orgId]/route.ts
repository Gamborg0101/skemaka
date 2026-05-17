import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"
import { serOrg } from "@/lib/serialize"
import { SUPPORTED_CURRENCIES } from "@/lib/orgSettings"

const VALID_CURRENCY_CODES = new Set(SUPPORTED_CURRENCIES.map((c) => c.code))

export async function PATCH(req: NextRequest, context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const body = await req.json() as { currency?: string }

  if (body.currency === undefined) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  if (!VALID_CURRENCY_CODES.has(body.currency)) {
    return NextResponse.json({ error: "Invalid currency code" }, { status: 400 })
  }

  const org = await db.organization.findFirst({
    where: { id: orgId },
    orderBy: { createdAt: "asc" },
  })
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const oldCurrency = org.currency
  const newCurrency = body.currency

  if (oldCurrency === newCurrency) {
    return NextResponse.json({ data: serOrg(org) })
  }

  // Fetch live exchange rate
  let rate: number
  try {
    const rateRes = await fetch(
      `https://api.frankfurter.app/latest?from=${oldCurrency}&to=${newCurrency}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!rateRes.ok) throw new Error("rate fetch failed")
    const rateData = await rateRes.json() as { rates: Record<string, number> }
    rate = rateData.rates[newCurrency]
    if (!rate) throw new Error("rate not in response")
  } catch {
    return NextResponse.json({ error: "Could not fetch exchange rate. Try again." }, { status: 502 })
  }

  // Convert all employee wages and save new currency in one transaction
  const employees = await db.employee.findMany({
    where: { organizationId: orgId },
    select: { id: true, hourlyWage: true },
  })

  try {
    await db.$transaction(async (tx) => {
      await tx.organization.update({ where: { id: orgId }, data: { currency: newCurrency } })
      for (const emp of employees) {
        const converted = Math.round(Number(emp.hourlyWage) * rate * 100) / 100
        await tx.employee.update({ where: { id: emp.id }, data: { hourlyWage: converted } })
      }
    })
  } catch (err) {
    console.error("[orgs PATCH]", err)
    return NextResponse.json({ error: "Failed to update currency" }, { status: 500 })
  }

  const updated = await db.organization.findFirst({
    where: { id: orgId },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json({ data: serOrg(updated!) })
}
