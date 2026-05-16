import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { resend } from "@/lib/resend"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { message } = await req.json()
  if (!message || typeof message !== "string" || message.trim().length < 5) {
    return NextResponse.json({ error: "Message too short" }, { status: 400 })
  }

  const reporter = session.user.name ?? session.user.email ?? "Unknown user"
  const reporterEmail = session.user.email ?? "unknown"

  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "noreply@skemaka.com",
    to: "gamborgc@gmail.com",
    subject: `Bug report from ${reporter}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
        <h2 style="font-size:18px;font-weight:600;margin-bottom:4px;">Bug Report</h2>
        <p style="color:#888;font-size:13px;margin-bottom:24px;">
          Submitted by <strong>${reporter}</strong> (${reporterEmail})
        </p>
        <div style="background:#f5f5f5;border-radius:8px;padding:16px 20px;white-space:pre-wrap;font-size:15px;color:#222;line-height:1.6;">
          ${message.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}
        </div>
      </div>
    `,
  })

  return NextResponse.json({ ok: true })
}
