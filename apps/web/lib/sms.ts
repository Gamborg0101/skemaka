import twilio from "twilio";
import { db } from "@/lib/prisma";

/** Standard A2P opt-out footer appended to every outbound message. */
const OPT_OUT_NOTICE = "Reply STOP to opt out.";

// Inbound keyword sets (case-insensitive). STOP/START mirror Twilio's standard
// Advanced Opt-Out keywords; we maintain our own list as a belt-and-suspenders
// suppression layer on top of carrier-level handling.
const STOP_KEYWORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);
const START_KEYWORDS = new Set(["start", "yes", "unstop"]);
const HELP_KEYWORDS = new Set(["help", "info"]);

export type SmsKeyword = "stop" | "start" | "help" | null;

/** Classify an inbound SMS body as a STOP/START/HELP keyword (or null). */
export function classifyKeyword(body: string): SmsKeyword {
  const word = body.trim().toLowerCase();
  if (STOP_KEYWORDS.has(word)) return "stop";
  if (START_KEYWORDS.has(word)) return "start";
  if (HELP_KEYWORDS.has(word)) return "help";
  return null;
}

/**
 * Normalize a phone number to a stable suppression-list key: keep a leading "+"
 * and digits only, dropping spaces, dashes, and parentheses. Twilio delivers the
 * inbound `From` in E.164, so this lets a STOP match employee numbers stored in
 * looser formats.
 */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/[^0-9]/g, "");
}

/** Record a STOP: suppress all future SMS to this number (idempotent). */
export async function suppressNumber(phone: string): Promise<void> {
  const key = normalizePhone(phone);
  await db.smsOptOut.upsert({ where: { phone: key }, create: { phone: key }, update: {} });
}

/** Record a START/UNSTOP: re-enable SMS to this number. */
export async function unsuppressNumber(phone: string): Promise<void> {
  const key = normalizePhone(phone);
  await db.smsOptOut.deleteMany({ where: { phone: key } });
}

async function isSuppressed(phone: string): Promise<boolean> {
  const row = await db.smsOptOut.findUnique({ where: { phone: normalizePhone(phone) } });
  return row !== null;
}

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

function formatShiftDate(
  dateStr: string,
  startTime: string,
  endTime: string,
): string {
  const date = new Date(dateStr + "T00:00:00Z");
  const day = date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return `${day}, ${startTime}–${endTime}`;
}

async function send(to: string, body: string): Promise<void> {
  const client = getClient();
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!client || !from) {
    console.warn("[sms] Twilio not configured — skipping SMS");
    return;
  }
  // Respect opt-out before doing anything else (carrier + legal compliance).
  if (await isSuppressed(to)) {
    console.warn("[sms] recipient has opted out — skipping SMS");
    return;
  }
  const recipient = process.env.TWILIO_TO_OVERRIDE ?? to;
  try {
    await client.messages.create({ body: `${body} ${OPT_OUT_NOTICE}`, from, to: recipient });
  } catch (err) {
    console.error("[sms] Failed to send SMS:", err);
  }
}

/**
 * Send a one-time phone-verification code. Unlike the notification helpers this
 * is a transactional message the recipient explicitly triggered (it's the opt-in
 * moment), so it does NOT append the STOP footer or run the opt-out suppression
 * check — it must go through even if the number was previously suppressed.
 * Returns true if Twilio accepted the message, false if SMS isn't configured or
 * the send failed (callers surface the dev code instead in non-production).
 */
export async function sendPhoneVerificationSms({
  to,
  code,
  orgName,
}: {
  to: string;
  code: string;
  orgName: string;
}): Promise<boolean> {
  const client = getClient();
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!client || !from) {
    console.warn("[sms] Twilio not configured — skipping verification SMS");
    return false;
  }
  const recipient = process.env.TWILIO_TO_OVERRIDE ?? to;
  try {
    await client.messages.create({
      body: `Your ${orgName} verification code is ${code}. It expires in 10 minutes.`,
      from,
      to: recipient,
    });
    return true;
  } catch (err) {
    console.error("[sms] Failed to send verification SMS:", err);
    return false;
  }
}

export async function sendShiftUpdatedSms({
  to,
  employeeName,
  orgName,
  date,
  startTime,
  endTime,
}: {
  to: string;
  employeeName: string;
  orgName: string;
  date: string;
  startTime: string;
  endTime: string;
}): Promise<void> {
  const when = formatShiftDate(date, startTime, endTime);
  await send(
    to,
    `Hi ${employeeName}, your shift at ${orgName} has been updated. New time: ${when}.`,
  );
}

export async function sendShiftAssignedSms({
  to,
  employeeName,
  orgName,
  date,
  startTime,
  endTime,
}: {
  to: string;
  employeeName: string;
  orgName: string;
  date: string;
  startTime: string;
  endTime: string;
}): Promise<void> {
  const when = formatShiftDate(date, startTime, endTime);
  await send(
    to,
    `Hi ${employeeName}, you've been scheduled for a shift at ${orgName}: ${when}.`,
  );
}

export async function sendSchedulePublishedSms({
  to,
  employeeName,
  orgName,
  weekLabel,
  shiftLines,
}: {
  to: string;
  employeeName: string;
  orgName: string;
  weekLabel: string;
  shiftLines: string[];
}): Promise<void> {
  const list =
    shiftLines.length > 0 ? shiftLines.join(", ") : "No shifts this week.";
  await send(
    to,
    `Hi ${employeeName}! ${orgName} published your schedule for ${weekLabel}. Your shifts: ${list}.`,
  );
}

export async function sendTimeOffApprovedSms({
  to,
  employeeName,
  startDate,
  endDate,
}: {
  to: string;
  employeeName: string;
  startDate: string;
  endDate: string;
}): Promise<void> {
  const fmt = (d: string) =>
    new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
  const range =
    startDate === endDate
      ? fmt(startDate)
      : `${fmt(startDate)} – ${fmt(endDate)}`;
  await send(
    to,
    `Hi ${employeeName}, your time-off request for ${range} has been approved.`,
  );
}

export async function sendTimeOffDeniedSms({
  to,
  employeeName,
  startDate,
  endDate,
  reviewNote,
}: {
  to: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  reviewNote?: string | null;
}): Promise<void> {
  const fmt = (d: string) =>
    new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
  const range =
    startDate === endDate
      ? fmt(startDate)
      : `${fmt(startDate)} – ${fmt(endDate)}`;
  const note = reviewNote ? ` Reason: ${reviewNote}` : "";
  await send(
    to,
    `Hi ${employeeName}, your time-off request for ${range} was not approved.${note}`,
  );
}

export async function sendShiftCancelledSms({
  to,
  employeeName,
  orgName,
  date,
  startTime,
  endTime,
}: {
  to: string;
  employeeName: string;
  orgName: string;
  date: string;
  startTime: string;
  endTime: string;
}): Promise<void> {
  const when = formatShiftDate(date, startTime, endTime);
  await send(
    to,
    `Hi ${employeeName}, your shift at ${orgName} on ${when} has been cancelled. Contact your manager if you have questions.`,
  );
}
