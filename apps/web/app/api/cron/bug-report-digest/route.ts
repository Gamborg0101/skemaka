import { timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { resend } from "@/lib/resend"
import { logError, logInfo } from "@/lib/log"

// Called daily by Vercel Cron (see vercel.json). Protected by CRON_SECRET.
// Sends a digest of the last 24h of bug reports to the superadmin. Immediate
// per-report alerts are still sent by /api/bug-report; this is the catch-all
// summary so nothing is missed.
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const authHeader = req.headers.get("authorization") ?? ""
  const expected = Buffer.from(`Bearer ${cronSecret}`)
  const actual = Buffer.from(authHeader)
  const valid = expected.length === actual.length && timingSafeEqual(expected, actual)
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const reports = await db.bugReport.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  const superadminEmail = process.env.SUPERADMIN_EMAIL
  if (reports.length === 0 || !superadminEmail) {
    logInfo("cron/bug-report-digest", "no digest sent", {
      count: reports.length,
      emailConfigured: Boolean(superadminEmail),
    })
    return NextResponse.json({ ok: true, count: reports.length, sent: false })
  }

  const crashes = reports.filter((r) => r.errorMessage).length
  const rows = reports
    .map((r) => {
      const kind = r.errorMessage ? "Crash" : "Bug"
      const summary = r.errorMessage ?? r.message ?? "(no message)"
      const who = r.userEmail ?? r.userName ?? "anonymous"
      return `<tr>
        <td style="padding:6px 10px;font-size:12px;color:#666;">${escapeHtml(r.createdAt.toISOString())}</td>
        <td style="padding:6px 10px;font-size:12px;">${kind}</td>
        <td style="padding:6px 10px;font-size:12px;">${escapeHtml(summary.slice(0, 120))}</td>
        <td style="padding:6px 10px;font-size:12px;color:#666;">${escapeHtml(who)}</td>
      </tr>`
    })
    .join("\n")

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "noreply@skemaka.com",
      to: superadminEmail,
      subject: `Skemaka bug digest — ${reports.length} report(s), ${crashes} crash(es) in 24h`,
      html: `
        <div style="font-family:sans-serif;max-width:720px;margin:0 auto;padding:24px;">
          <h2 style="font-size:18px;font-weight:600;">Bug report digest (last 24h)</h2>
          <p style="font-size:13px;color:#666;">${reports.length} report(s), of which ${crashes} crash(es).</p>
          <table style="border-collapse:collapse;width:100%;">
            <thead><tr style="text-align:left;border-bottom:1px solid #ddd;">
              <th style="padding:6px 10px;font-size:12px;">Time (UTC)</th>
              <th style="padding:6px 10px;font-size:12px;">Type</th>
              <th style="padding:6px 10px;font-size:12px;">Summary</th>
              <th style="padding:6px 10px;font-size:12px;">Reporter</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `,
    })
  } catch (err) {
    logError("cron/bug-report-digest", err)
    return NextResponse.json({ ok: false, error: "email failed" }, { status: 500 })
  }

  logInfo("cron/bug-report-digest", "digest sent", { count: reports.length, crashes })
  return NextResponse.json({ ok: true, count: reports.length, crashes, sent: true })
}
