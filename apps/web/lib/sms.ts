import twilio from "twilio";

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
  const recipient = process.env.TWILIO_TO_OVERRIDE ?? to;
  try {
    await client.messages.create({ body, from, to: recipient });
  } catch (err) {
    console.error("[sms] Failed to send SMS:", err);
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
