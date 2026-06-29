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

export async function sendClaimCodeEmail({ to, name, orgName, code }: ClaimCodeOptions) {
  return getResend().emails.send({
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
  })
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
          You've been added as a team member at <strong>${orgName}</strong>.
        </p>
        <p style="color: #555; margin-bottom: 24px;">
          Click the button below to view your shifts and submit your availability. No password required.
        </p>
        <a href="${inviteUrl}" style="display: inline-block; background: #111; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
          View my shifts
        </a>
        ${joinUrl ? `
        <div style="margin-top: 24px; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
          <p style="color: #374151; font-size: 14px; margin: 0 0 12px;">
            <strong>Create your account</strong> to see your shifts in the app and get availability notifications.
          </p>
          <a href="${joinUrl}" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 500;">
            Create my account
          </a>
        </div>
        ` : ""}
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          These links are personal to you — please don't share them.
        </p>
      </div>
    `,
  })
}
