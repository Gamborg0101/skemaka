import "server-only"
import { Resend } from "resend"
import type { Locale } from "@skemaka/i18n"
import { getMessageTranslator } from "@/lib/messages"

// HTML tag renderer for <strong> markup embedded in email catalog strings.
const strong = (chunks: string) => `<strong>${chunks}</strong>`

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
  locale?: Locale
}

interface AvailabilityInviteOptions {
  to: string
  name: string
  orgName: string
  availabilityUrl: string
  weekLabel: string
  deadline: string
  locale?: Locale
}

interface ShiftAssignedOptions {
  to: string
  name: string
  orgName: string
  dateLabel: string
  startTime: string
  endTime: string
  jobRole: string
  locale?: Locale
}

export async function sendAvailabilityInviteEmail({
  to,
  name,
  orgName,
  availabilityUrl,
  weekLabel,
  deadline,
  locale = "en",
}: AvailabilityInviteOptions) {
  const t = getMessageTranslator(locale, "emails")
  return getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "noreply@skemaka.com",
    to,
    subject: t("availabilityInvite.subject", { week: weekLabel, orgName }),
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">${t("greeting", { name })}</h2>
        <p style="color: #555; margin-bottom: 8px;">
          ${t.markup("availabilityInvite.building", { orgName, week: weekLabel, strong })}
        </p>
        <p style="color: #555; margin-bottom: 24px;">
          ${t.markup("availabilityInvite.deadline", { deadline, strong })}
        </p>
        <a href="${availabilityUrl}" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
          ${t("availabilityInvite.cta")}
        </a>
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          ${t("personalLink")}
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
  locale?: Locale
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

export async function sendClaimCodeEmail({ to, name, orgName, code, locale = "en" }: ClaimCodeOptions) {
  const t = getMessageTranslator(locale, "emails")
  return sendWithRetry(() => getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "noreply@skemaka.com",
    to,
    subject: t("claimCode.subject", { code }),
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">${t("greeting", { name })}</h2>
        <p style="color: #555; margin-bottom: 8px;">
          ${t.markup("claimCode.intro", { orgName, strong })}
        </p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111; background: #f3f4f6; border-radius: 8px; padding: 16px 24px; text-align: center; margin: 16px 0;">
          ${code}
        </div>
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          ${t("claimCode.expiry")}
        </p>
      </div>
    `,
  }))
}

export async function sendInviteEmail({ to, name, orgName, inviteUrl, joinUrl, locale = "en" }: InviteEmailOptions) {
  const t = getMessageTranslator(locale, "emails")
  // White-on-dark <strong> for the install box.
  const strongW = (chunks: string) => `<strong style="color:#ffffff;">${chunks}</strong>`
  return getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "noreply@skemaka.com",
    to,
    subject: t("invite.subject", { orgName }),
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">${t("greeting", { name })}</h2>
        <p style="color: #555; margin-bottom: 8px;">
          ${t.markup("invite.added", { orgName, strong })}
        </p>
        <p style="color: #555; margin-bottom: 24px;">
          ${t("invite.getStarted")}
        </p>
        <a href="${joinUrl ?? inviteUrl}" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
          ${t("invite.cta")}
        </a>

        <div style="margin-top: 28px; padding: 18px; background: #0f172a; border-radius: 8px;">
          <p style="color: #ffffff; font-size: 14px; font-weight: 600; margin: 0 0 10px;">
            ${t("invite.installTitle")}
          </p>
          <p style="color: #cbd5e1; font-size: 13px; line-height: 1.6; margin: 0 0 12px;">
            ${t("invite.installIntro")}
          </p>
          <p style="color: #cbd5e1; font-size: 13px; line-height: 1.75; margin: 0 0 12px;">
            <strong style="color:#ffffff;">${t("invite.iphone")}</strong>:<br>
            1. ${t.markup("invite.iphone1", { strong: strongW })}<br>
            2. ${t.markup("invite.iphone2", { strong: strongW })}<br>
            3. ${t.markup("invite.iphone3", { strong: strongW })}
          </p>
          <p style="color: #cbd5e1; font-size: 13px; line-height: 1.75; margin: 0;">
            <strong style="color:#ffffff;">${t("invite.android")}</strong>:<br>
            1. ${t.markup("invite.android1", { strong: strongW })}<br>
            2. ${t.markup("invite.android2", { strong: strongW })}<br>
            3. ${t.markup("invite.android3", { strong: strongW })}
          </p>
        </div>

        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          ${t("personalLink")}
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
  to, name, orgName, dateLabel, startTime, endTime, jobRole, locale = "en",
}: ShiftAssignedOptions) {
  const t = getMessageTranslator(locale, "emails")
  return getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "noreply@skemaka.com",
    to,
    subject: t("shiftAssigned.subject", { date: dateLabel, orgName }),
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">${t("greeting", { name })}</h2>
        <p style="color: #555; margin-bottom: 20px;">
          ${t.markup("shiftAssigned.intro", { orgName, strong })}
        </p>
        <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px 20px; margin-bottom: 20px;">
          <p style="margin: 0 0 6px; font-size: 16px; font-weight: 600; color: #111;">${dateLabel}</p>
          <p style="margin: 0 0 4px; color: #374151;">${startTime} – ${endTime}</p>
          <p style="margin: 0; color: #6b7280; font-size: 14px;">${jobRole}</p>
        </div>
        <p style="color: #999; font-size: 13px;">
          ${t("shiftAssigned.footer")}
        </p>
      </div>
    `,
  })
}

/**
 * Sent when a manager cancels a shift. Unlike edits/deletes (which revert the
 * week to draft and defer to the re-publish blast), a cancellation notifies
 * the one affected employee directly and immediately.
 */
export async function sendShiftCancelledEmail({
  to, name, orgName, dateLabel, startTime, endTime, jobRole, locale = "en",
}: ShiftAssignedOptions) {
  const t = getMessageTranslator(locale, "emails")
  return getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "noreply@skemaka.com",
    to,
    subject: t("shiftCancelled.subject", { date: dateLabel, orgName }),
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">${t("greeting", { name })}</h2>
        <p style="color: #555; margin-bottom: 20px;">
          ${t.markup("shiftCancelled.intro", { orgName, strong })}
        </p>
        <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px 20px; margin-bottom: 20px;">
          <p style="margin: 0 0 6px; font-size: 16px; font-weight: 600; color: #111; text-decoration: line-through;">${dateLabel}</p>
          <p style="margin: 0 0 4px; color: #374151; text-decoration: line-through;">${startTime} – ${endTime}</p>
          <p style="margin: 0; color: #6b7280; font-size: 14px;">${jobRole}</p>
        </div>
        <p style="color: #999; font-size: 13px;">
          ${t("shiftCancelled.footer")}
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
  locale?: Locale
}

/** Sent to every employee with a shift when a manager rolls out the schedule. */
export async function sendShiftsRolledOutEmail({
  to, name, orgName, periodLabel, locale = "en",
}: ShiftsRolledOutOptions) {
  const t = getMessageTranslator(locale, "emails")
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://skemaka.com"
  return getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "noreply@skemaka.com",
    to,
    subject: t("rolledOut.subject"),
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">${t("greeting", { name })}</h2>
        <p style="color: #555; margin-bottom: 20px;">
          ${t.markup("rolledOut.body", { orgName, period: periodLabel, strong })}
        </p>
        <a href="${appUrl}/portal"
           style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:10px;">
          ${t("rolledOut.cta")}
        </a>
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          ${t("rolledOut.footer", { orgName })}
        </p>
      </div>
    `,
  })
}
