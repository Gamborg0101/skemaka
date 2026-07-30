-- Manager-initiated shift offers: a manager offers a brand-new slot to a set of
-- employees, who accept/decline; the manager confirms one winner (creating the
-- Shift) and the offer is marked FILLED. Distinct from ShiftCoverRequest, which
-- is employee-initiated over an existing shift.

-- CreateEnum
CREATE TYPE "ShiftOfferStatus" AS ENUM ('OPEN', 'FILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShiftOfferResponse" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "ShiftOffer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "jobRole" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" "ShiftOfferStatus" NOT NULL DEFAULT 'OPEN',
    "createdByUserId" TEXT NOT NULL,
    "filledShiftId" TEXT,
    "filledEmployeeId" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftOfferRecipient" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "response" "ShiftOfferResponse" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftOfferRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftOffer_organizationId_idx" ON "ShiftOffer"("organizationId");

-- CreateIndex
CREATE INDEX "ShiftOffer_organizationId_status_idx" ON "ShiftOffer"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftOfferRecipient_offerId_employeeId_key" ON "ShiftOfferRecipient"("offerId", "employeeId");

-- CreateIndex
CREATE INDEX "ShiftOfferRecipient_offerId_idx" ON "ShiftOfferRecipient"("offerId");

-- CreateIndex
CREATE INDEX "ShiftOfferRecipient_employeeId_idx" ON "ShiftOfferRecipient"("employeeId");

-- AddForeignKey
ALTER TABLE "ShiftOffer" ADD CONSTRAINT "ShiftOffer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftOfferRecipient" ADD CONSTRAINT "ShiftOfferRecipient_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "ShiftOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftOfferRecipient" ADD CONSTRAINT "ShiftOfferRecipient_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
