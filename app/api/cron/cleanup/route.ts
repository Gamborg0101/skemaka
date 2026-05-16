import { NextRequest, NextResponse } from "next/server"
import { runGlobalCleanup } from "@/lib/cleanup"

// Called weekly by Vercel Cron (see vercel.json).
// Protected by CRON_SECRET — Vercel injects it automatically.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await runGlobalCleanup()
  console.log("[cron/cleanup] completed:", result)
  return NextResponse.json({ ok: true, deleted: result })
}
