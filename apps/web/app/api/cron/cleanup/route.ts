import { timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { runGlobalCleanup } from "@/lib/cleanup"
import { db } from "@/lib/prisma"

// Called weekly by Vercel Cron (see vercel.json).
// Protected by CRON_SECRET — Vercel injects it automatically.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const authHeader = req.headers.get("authorization") ?? ""
  const expected = Buffer.from(`Bearer ${cronSecret}`)
  const actual = Buffer.from(authHeader)
  const valid =
    expected.length === actual.length && timingSafeEqual(expected, actual)
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await runGlobalCleanup()

  // Purge audit events older than 90 days to prevent unbounded table growth
  const eventCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const { count: eventsDeleted } = await db.schedulingEvent.deleteMany({
    where: { createdAt: { lt: eventCutoff } },
  })

  console.log("[cron/cleanup] completed:", result, { eventsDeleted })
  return NextResponse.json({ ok: true, deleted: result, eventsDeleted })
}
