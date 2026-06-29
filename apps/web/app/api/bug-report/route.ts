import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { resend } from "@/lib/resend"
import { db } from "@/lib/prisma"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { logWarn, logError, requestIdFrom } from "@/lib/log"

const MAX_MESSAGE = 2000
const MAX_ERROR_MESSAGE = 500
const MAX_STACK = 10_000
const MAX_URL = 2000
const MAX_COMPONENT = 200

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}

function safeHref(raw: string): string | null {
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    return parsed.href
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const { success } = await rateLimitRequest(getClientIp(req.headers), "report")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const session = await auth()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const message = typeof body.message === "string" ? body.message.slice(0, MAX_MESSAGE) : null
  const errorMessage = typeof body.errorMessage === "string" ? body.errorMessage.slice(0, MAX_ERROR_MESSAGE) : null
  const errorStack = typeof body.errorStack === "string" ? body.errorStack.slice(0, MAX_STACK) : null
  const url = typeof body.url === "string" ? body.url.slice(0, MAX_URL) : null
  const component = typeof body.component === "string" ? body.component.slice(0, MAX_COMPONENT) : null

  // Allow unauthenticated crash reports; skip userId/orgId if no session
  const userId = session?.user?.id ?? null
  const orgId = session?.user?.orgId ?? null
  const userName = session?.user?.name ?? null
  const userEmail = session?.user?.email ?? null

  let orgName: string | null = null
  if (orgId) {
    const org = await db.organization.findFirst({
      where: { id: orgId },
      select: { name: true },
      orderBy: { createdAt: "asc" },
    })
    orgName = org?.name ?? null
  }

  await db.bugReport.create({
    data: {
      organizationId: orgId,
      userId,
      orgName,
      userName,
      userEmail,
      message,
      errorMessage,
      errorStack,
      url,
      component,
    },
  })

  const reporter = userName ?? userEmail ?? "Unknown user"
  const reporterEmail = userEmail ?? "unknown"
  const stackTruncated = errorStack
    ? errorStack.slice(0, 3000) + (errorStack.length > 3000 ? "\n… (truncated)" : "")
    : null

  const htmlParts: string[] = []
  if (userName || userEmail) {
    htmlParts.push(
      `<p style="color:#888;font-size:13px;margin-bottom:24px;">
        Submitted by <strong>${escapeHtml(reporter)}</strong> (${escapeHtml(reporterEmail)})
        ${orgName ? `— Org: <strong>${escapeHtml(orgName)}</strong>` : ""}
      </p>`
    )
  }
  if (message) {
    htmlParts.push(
      `<h3 style="font-size:14px;font-weight:600;margin-bottom:6px;">User message</h3>
      <div style="background:#f5f5f5;border-radius:8px;padding:16px 20px;white-space:pre-wrap;font-size:15px;color:#222;line-height:1.6;margin-bottom:20px;">
        ${escapeHtml(message.trim())}
      </div>`
    )
  }
  if (errorMessage) {
    htmlParts.push(
      `<h3 style="font-size:14px;font-weight:600;margin-bottom:6px;">Error message</h3>
      <div style="background:#fff0f0;border-left:4px solid #e53e3e;border-radius:4px;padding:12px 16px;font-size:13px;color:#c53030;font-family:monospace;margin-bottom:20px;">
        ${escapeHtml(errorMessage)}
      </div>`
    )
  }
  if (url) {
    const href = safeHref(url)
    htmlParts.push(
      `<p style="font-size:13px;color:#666;margin-bottom:20px;">
        <strong>URL:</strong> ${href
          ? `<a href="${escapeHtml(href)}" style="color:#3b82f6;">${escapeHtml(href)}</a>`
          : escapeHtml(url)
        }
      </p>`
    )
  }
  if (stackTruncated) {
    htmlParts.push(
      `<h3 style="font-size:14px;font-weight:600;margin-bottom:6px;">Stack trace</h3>
      <pre style="background:#1a1a1a;color:#e5e7eb;border-radius:8px;padding:16px;font-size:11px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;">${escapeHtml(stackTruncated)}</pre>`
    )
  }

  const subject = errorMessage
    ? `[Crash] ${errorMessage.slice(0, 80)} — ${reporter}`
    : `Bug report from ${reporter}`

  const superadminEmail = process.env.SUPERADMIN_EMAIL
  if (!superadminEmail) {
    logWarn("bug-report", "SUPERADMIN_EMAIL is not set — skipping email notification", {
      requestId: requestIdFrom(req.headers),
    })
    return NextResponse.json({ ok: true })
  }

  // The report is already persisted; a failed email must not fail the request or
  // lose the report. Log and acknowledge.
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "noreply@skemaka.com",
      to: superadminEmail,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:620px;margin:0 auto;padding:32px 24px;">
          <h2 style="font-size:18px;font-weight:600;margin-bottom:4px;">
            ${errorMessage ? "Crash Report" : "Bug Report"}
          </h2>
          ${htmlParts.join("\n")}
        </div>
      `,
    })
  } catch (err) {
    logError("bug-report", err, { requestId: requestIdFrom(req.headers) })
  }

  return NextResponse.json({ ok: true })
}
