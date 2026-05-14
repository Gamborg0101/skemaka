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
}

export async function sendInviteEmail({ to, name, orgName, inviteUrl }: InviteEmailOptions) {
  return getResend().emails.send({
    from: process.env.EMAIL_FROM ?? "noreply@skemaka.com",
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
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          This link is personal to you — please don't share it.
        </p>
      </div>
    `,
  })
}
