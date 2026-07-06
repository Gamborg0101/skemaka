import "server-only"
import { Resend } from "resend"

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY ?? "")
  }
  return _resend
}

export const resend = new Proxy({} as Resend, {
  get(_target, prop) {
    return getResend()[prop as keyof Resend]
  },
})

interface InviteEmailOptions {
  to: string
  name: string
  orgName: string
  inviteUrl: string
  joinUrl?: string
}

interface AvailabilityInviteOptions {
  to: string
  name: string
  orgName: string
  availabilityUrl: string
  weekLabel: string
  deadline: string
}

interface ShiftAssignedOptions {
  to: string
  name: string
  orgName: string
  dateLabel: string
  startTime: string
  endTime: string
  jobRole: string
}

export async function sendAvailabilityInviteEmail({
  to,
  name,
  orgName,
  availabilityUrl,
  weekLabel,
  deadline,
}: AvailabilityInviteOptions) {
  return getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "noreply@skemaka.com",
    to,
    subject: `Share your availability for the week of ${weekLabel} — ${orgName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">Hi ${name},</h2>
        <p style="color: #555; margin-bottom: 8px;">
          <strong>${orgName}</strong> is building the schedule for the week of <strong>${weekLabel}</strong>.
        </p>
        <p style="color: #555; margin-bottom: 24px;">
          Please share your availability before <strong>${deadline}</strong> by clicking the button below.
        </p>
        <a href="${availabilityUrl}" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
          Submit my availability
        </a>
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          This link is personal to you — please don't share it.
        </p>
      </div>
    `,
  })
}

interface ClaimCodeOptions {
  to: string
  name: string
  orgName: string
  code: string
}

/**
 * Retry a Resend send a few times before giving up. Transient failures
 * (network blips, brief Resend 5xx) would otherwise leave the caller thinking a
 * code was sent when it never left the building — the classic "I had to press
 * send again" bug. Short, bounded backoff keeps the request responsive.
 */
async function sendWithRetry<T>(send: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await send()
    } catch (err) {
      lastErr = err
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 250 * (i + 1)))
      }
    }
  }
  throw lastErr
}

export async function sendClaimCodeEmail({ to, name, orgName, code }: ClaimCodeOptions) {
  return sendWithRetry(() => getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "noreply@skemaka.com",
    to,
    subject: `Your Skemaka verification code: ${code}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">Hi ${name},</h2>
        <p style="color: #555; margin-bottom: 8px;">
          Use this code to link your account to <strong>${orgName}</strong> on Skemaka:
        </p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111; background: #f3f4f6; border-radius: 8px; padding: 16px 24px; text-align: center; margin: 16px 0;">
          ${code}
        </div>
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          This code expires in 10 minutes. If you didn't request it, you can ignore this email — your account is safe.
        </p>
      </div>
    `,
  }))
}

export async function sendInviteEmail({ to, name, orgName, inviteUrl, joinUrl }: InviteEmailOptions) {
  return getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "noreply@skemaka.com",
    to,
    subject: `You've been added to ${orgName} on Skemaka`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">Hi ${name},</h2>
        <p style="color: #555; margin-bottom: 8px;">
          You've been added as a team member at <strong>${orgName}</strong> on Skemaka.
        </p>
        <p style="color: #555; margin-bottom: 24px;">
          To get started, create your account below. Once you're in, you can view your shifts,
          submit your availability, and request time off.
        </p>
        <a href="${joinUrl ?? inviteUrl}" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
          Create my account
        </a>

        <div style="margin-top: 28px; padding: 18px; background: #0f172a; border-radius: 8px;">
          <p style="color: #ffffff; font-size: 14px; font-weight: 600; margin: 0 0 10px;">
            Add Skemaka to your phone
          </p>
          <p style="color: #cbd5e1; font-size: 13px; line-height: 1.6; margin: 0 0 12px;">
            Skemaka works like an app on your phone. Here's how to add it to your home screen:
          </p>
          <p style="color: #cbd5e1; font-size: 13px; line-height: 1.75; margin: 0 0 12px;">
            <strong style="color:#ffffff;">On iPhone</strong>:<br>
            1. Open <strong style="color:#ffffff;">skemaka.com</strong> in your browser.<br>
            2. Tap the <strong style="color:#ffffff;">Share</strong> icon.<br>
            3. Tap <strong style="color:#ffffff;">Add to Home Screen</strong>, then tap <strong style="color:#ffffff;">Add</strong>.
          </p>
          <p style="color: #cbd5e1; font-size: 13px; line-height: 1.75; margin: 0;">
            <strong style="color:#ffffff;">On Android</strong>:<br>
            1. Open <strong style="color:#ffffff;">skemaka.com</strong> in your browser.<br>
            2. Tap the <strong style="color:#ffffff;">&#8942;</strong> menu.<br>
            3. Tap <strong style="color:#ffffff;">Add to Home screen</strong>.
          </p>
        </div>

        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          This link is personal to you — please don't share it.
        </p>
      </div>
    `,
  })
}

/**
 * Sent when a manager adds a single shift to an already-published week — i.e. a
 * one-off assignment outside the normal publish/roll-out flow. The whole-week
 * publish notifies the team separately; this is a direct heads-up to the one
 * affected employee.
 */
export async function sendShiftAssignedEmail({
  to, name, orgName, dateLabel, startTime, endTime, jobRole,
}: ShiftAssignedOptions) {
  return getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "noreply@skemaka.com",
    to,
    subject: `New shift on ${dateLabel} — ${orgName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">Hi ${name},</h2>
        <p style="color: #555; margin-bottom: 20px;">
          You've been given a new shift at <strong>${orgName}</strong>.
        </p>
        <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px 20px; margin-bottom: 20px;">
          <p style="margin: 0 0 6px; font-size: 16px; font-weight: 600; color: #111;">${dateLabel}</p>
          <p style="margin: 0 0 4px; color: #374151;">${startTime} – ${endTime}</p>
          <p style="margin: 0; color: #6b7280; font-size: 14px;">${jobRole}</p>
        </div>
        <p style="color: #999; font-size: 13px;">
          Open Skemaka to see your full schedule.
        </p>
      </div>
    `,
  })
}

interface ShiftsRolledOutOptions {
  to: string
  name: string
  orgName: string
  periodLabel: string
}

/** Sent to every employee with a shift when a manager rolls out the schedule. */
export async function sendShiftsRolledOutEmail({
  to, name, orgName, periodLabel,
}: ShiftsRolledOutOptions) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://skemaka.com"
  return getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "noreply@skemaka.com",
    to,
    subject: "New shifts in Skemaka",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">Hi ${name},</h2>
        <p style="color: #555; margin-bottom: 20px;">
          <strong>${orgName}</strong> just rolled out the schedule for <strong>${periodLabel}</strong>.
          Open Skemaka to see your shifts.
        </p>
        <a href="${appUrl}/portal"
           style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:10px;">
          View my shifts
        </a>
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          You're receiving this because you have shifts at ${orgName} on Skemaka.
        </p>
      </div>
    `,
  })
}
