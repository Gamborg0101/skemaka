-- SMS opt-out (STOP) compliance: per-number suppression list + employee consent
-- timestamp.

-- AlterTable: record when SMS consent was asserted at employee creation.
ALTER TABLE "Employee" ADD COLUMN "smsConsentAt" TIMESTAMP(3);

-- CreateTable: suppression list keyed by E.164-normalized phone number.
CREATE TABLE "SmsOptOut" (
    "phone"     TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsOptOut_pkey" PRIMARY KEY ("phone")
);
