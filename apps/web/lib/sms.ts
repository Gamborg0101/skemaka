import "server-only";
import twilio from "twilio";
import { db } from "@/lib/prisma";
import type { Locale } from "@skemaka/i18n";
import { getMessageTranslator, recipientLocaleTag } from "@/lib/messages";

// Inbound keyword sets (case-insensitive). STOP/START mirror Twilio's standard
// Advanced Opt-Out keywords; we maintain our own list as a belt-and-suspenders
// suppression layer on top of carrier-level handling. Danish equivalents are
// included so DK staff can opt out in their own language.
const STOP_KEYWORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "afmeld"]);
const START_KEYWORDS = new Set(["start", "yes", "unstop", "tilmeld", "ja"]);
const HELP_KEYWORDS = new Set(["help", "info", "hjælp", "hjaelp"]);

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
  locale: Locale = "en",
): string {
  const date = new Date(dateStr + "T00:00:00Z");
  const day = date.toLocaleDateString(recipientLocaleTag(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return `${day}, ${startTime}–${endTime}`;
}

async function send(to: string, body: string, locale: Locale = "en"): Promise<void> {
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
  // Standard A2P opt-out footer appended to every outbound message.
  const optOut = getMessageTranslator(locale, "sms")("optOut");
  const recipient = process.env.TWILIO_TO_OVERRIDE ?? to;
  try {
    await client.messages.create({ body: `${body} ${optOut}`, from, to: recipient });
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
  locale = "en",
}: {
  to: string;
  code: string;
  orgName: string;
  locale?: Locale;
}): Promise<boolean> {
  const client = getClient();
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!client || !from) {
    console.warn("[sms] Twilio not configured — skipping verification SMS");
    return false;
  }
  const t = getMessageTranslator(locale, "sms");
  const recipient = process.env.TWILIO_TO_OVERRIDE ?? to;
  try {
    await client.messages.create({
      body: t("verification", { orgName, code }),
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
  locale = "en",
}: {
  to: string;
  employeeName: string;
  orgName: string;
  date: string;
  startTime: string;
  endTime: string;
  locale?: Locale;
}): Promise<void> {
  const t = getMessageTranslator(locale, "sms");
  const when = formatShiftDate(date, startTime, endTime, locale);
  await send(to, t("shiftUpdated", { name: employeeName, orgName, when }), locale);
}

export async function sendShiftAssignedSms({
  to,
  employeeName,
  orgName,
  date,
  startTime,
  endTime,
  locale = "en",
}: {
  to: string;
  employeeName: string;
  orgName: string;
  date: string;
  startTime: string;
  endTime: string;
  locale?: Locale;
}): Promise<void> {
  const t = getMessageTranslator(locale, "sms");
  const when = formatShiftDate(date, startTime, endTime, locale);
  await send(to, t("shiftAssigned", { name: employeeName, orgName, when }), locale);
}

export async function sendSchedulePublishedSms({
  to,
  employeeName,
  orgName,
  weekLabel,
  shiftLines,
  locale = "en",
}: {
  to: string;
  employeeName: string;
  orgName: string;
  weekLabel: string;
  shiftLines: string[];
  locale?: Locale;
}): Promise<void> {
  const t = getMessageTranslator(locale, "sms");
  const list = shiftLines.length > 0 ? shiftLines.join(", ") : t("noShifts");
  await send(
    to,
    t("schedulePublished", { name: employeeName, orgName, week: weekLabel, list }),
    locale,
  );
}

/**
 * Sent once per employee when a manager rolls out a (possibly multi-week)
 * schedule. Summary only — the per-shift detail lives in the app, which the
 * roll-out may span months of.
 */
export async function sendRollOutSms({
  to,
  employeeName,
  orgName,
  periodLabel,
  locale = "en",
}: {
  to: string;
  employeeName: string;
  orgName: string;
  periodLabel: string;
  locale?: Locale;
}): Promise<void> {
  const t = getMessageTranslator(locale, "sms");
  await send(to, t("rollOut", { name: employeeName, orgName, period: periodLabel }), locale);
}

function formatDateRange(startDate: string, endDate: string, locale: Locale): string {
  const fmt = (d: string) =>
    new Date(d + "T00:00:00Z").toLocaleDateString(recipientLocaleTag(locale), {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
  return startDate === endDate ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`;
}

export async function sendTimeOffApprovedSms({
  to,
  employeeName,
  startDate,
  endDate,
  locale = "en",
}: {
  to: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  locale?: Locale;
}): Promise<void> {
  const t = getMessageTranslator(locale, "sms");
  const range = formatDateRange(startDate, endDate, locale);
  await send(to, t("timeOffApproved", { name: employeeName, range }), locale);
}

export async function sendTimeOffDeniedSms({
  to,
  employeeName,
  startDate,
  endDate,
  reviewNote,
  locale = "en",
}: {
  to: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  reviewNote?: string | null;
  locale?: Locale;
}): Promise<void> {
  const t = getMessageTranslator(locale, "sms");
  const range = formatDateRange(startDate, endDate, locale);
  const note = reviewNote ? t("timeOffDeniedReason", { reason: reviewNote }) : "";
  await send(to, t("timeOffDenied", { name: employeeName, range, note }), locale);
}

export async function sendShiftCancelledSms({
  to,
  employeeName,
  orgName,
  date,
  startTime,
  endTime,
  locale = "en",
}: {
  to: string;
  employeeName: string;
  orgName: string;
  date: string;
  startTime: string;
  endTime: string;
  locale?: Locale;
}): Promise<void> {
  const t = getMessageTranslator(locale, "sms");
  const when = formatShiftDate(date, startTime, endTime, locale);
  await send(to, t("shiftCancelled", { name: employeeName, orgName, when }), locale);
}

// ─── Shift cover requests ─────────────────────────────────────────────────────

export async function sendCoverOfferedSms({
  to,
  employeeName,
  orgName,
  date,
  startTime,
  endTime,
  jobRole,
  locale = "en",
}: {
  to: string;
  employeeName: string;
  orgName: string;
  date: string;
  startTime: string;
  endTime: string;
  jobRole: string;
  locale?: Locale;
}): Promise<void> {
  const t = getMessageTranslator(locale, "sms");
  const when = formatShiftDate(date, startTime, endTime, locale);
  await send(to, t("coverOffered", { name: employeeName, jobRole, orgName, when }), locale);
}

export async function sendCoverClaimedSms({
  to,
  requesterName,
  claimerName,
  orgName,
  date,
  startTime,
  endTime,
  locale = "en",
}: {
  to: string;
  requesterName: string;
  claimerName: string;
  orgName: string;
  date: string;
  startTime: string;
  endTime: string;
  locale?: Locale;
}): Promise<void> {
  const t = getMessageTranslator(locale, "sms");
  const when = formatShiftDate(date, startTime, endTime, locale);
  await send(
    to,
    t("coverClaimed", { name: requesterName, claimer: claimerName, orgName, when }),
    locale,
  );
}

export async function sendCoverApprovedSms({
  to,
  name,
  orgName,
  date,
  startTime,
  endTime,
  role,
  locale = "en",
}: {
  to: string;
  name: string;
  orgName: string;
  date: string;
  startTime: string;
  endTime: string;
  role: "requester" | "claimer";
  locale?: Locale;
}): Promise<void> {
  const t = getMessageTranslator(locale, "sms");
  const when = formatShiftDate(date, startTime, endTime, locale);
  await send(
    to,
    role === "requester"
      ? t("coverApprovedRequester", { name, orgName, when })
      : t("coverApprovedClaimer", { name, orgName, when }),
    locale,
  );
}

export async function sendCoverDeniedSms({
  to,
  name,
  orgName,
  date,
  startTime,
  endTime,
  locale = "en",
}: {
  to: string;
  name: string;
  orgName: string;
  date: string;
  startTime: string;
  endTime: string;
  locale?: Locale;
}): Promise<void> {
  const t = getMessageTranslator(locale, "sms");
  const when = formatShiftDate(date, startTime, endTime, locale);
  await send(to, t("coverDenied", { name, orgName, when }), locale);
}

// ─── Shift offers (manager offers a slot to hand-picked staff) ─────────────────

export async function sendShiftOfferedSms({
  to,
  name,
  orgName,
  date,
  startTime,
  endTime,
  jobRole,
  locale = "en",
}: {
  to: string;
  name: string;
  orgName: string;
  date: string;
  startTime: string;
  endTime: string;
  jobRole: string;
  locale?: Locale;
}): Promise<void> {
  const t = getMessageTranslator(locale, "sms");
  const when = formatShiftDate(date, startTime, endTime, locale);
  await send(to, t("shiftOffered", { name, jobRole, orgName, when }), locale);
}

export async function sendShiftOfferResultSms({
  to,
  name,
  orgName,
  date,
  startTime,
  endTime,
  won,
  locale = "en",
}: {
  to: string;
  name: string;
  orgName: string;
  date: string;
  startTime: string;
  endTime: string;
  won: boolean;
  locale?: Locale;
}): Promise<void> {
  const t = getMessageTranslator(locale, "sms");
  const when = formatShiftDate(date, startTime, endTime, locale);
  await send(
    to,
    won
      ? t("shiftOfferWon", { name, orgName, when })
      : t("shiftOfferFilled", { name, orgName, when }),
    locale,
  );
}
