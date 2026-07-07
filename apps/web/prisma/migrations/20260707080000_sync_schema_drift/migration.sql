-- CreateEnum
CREATE TYPE "CoverRequestStatus" AS ENUM ('OPEN', 'CLAIMED', 'APPROVED', 'DENIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BugStatus" AS ENUM ('OPEN', 'RESOLVED');

-- DropIndex
DROP INDEX "Employee_userId_idx";

-- DropIndex
DROP INDEX "Membership_userId_idx";

-- DropIndex
DROP INDEX "Schedule_organizationId_weekStart_idx";

-- AlterTable
ALTER TABLE "AvailabilityDay" DROP COLUMN "preferredEnd",
DROP COLUMN "preferredStart",
ADD COLUMN     "endTime" TEXT,
ADD COLUMN     "startTime" TEXT;

-- AlterTable
ALTER TABLE "BugReport" ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "status" "BugStatus" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Organization" DROP COLUMN "employeeCount",
ADD COLUMN     "country" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "locale" TEXT,
ADD COLUMN     "timezone" TEXT;

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "shiftId" TEXT,
    "clockIn" TIMESTAMP(3) NOT NULL,
    "clockOut" TIMESTAMP(3),
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftCoverRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "requesterEmployeeId" TEXT NOT NULL,
    "claimedByEmployeeId" TEXT,
    "status" "CoverRequestStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "resolvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ShiftCoverRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdminAudit" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "organizationId" TEXT,
    "orgName" TEXT,
    "action" TEXT NOT NULL,
    "method" TEXT,
    "path" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuperAdminAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeEntry_organizationId_idx" ON "TimeEntry"("organizationId");

-- CreateIndex
CREATE INDEX "TimeEntry_employeeId_idx" ON "TimeEntry"("employeeId");

-- CreateIndex
CREATE INDEX "TimeEntry_shiftId_idx" ON "TimeEntry"("shiftId");

-- CreateIndex
CREATE INDEX "TimeEntry_organizationId_employeeId_clockOut_idx" ON "TimeEntry"("organizationId", "employeeId", "clockOut");

-- CreateIndex
CREATE INDEX "TimeEntry_organizationId_clockIn_idx" ON "TimeEntry"("organizationId", "clockIn");

-- CreateIndex
CREATE INDEX "ShiftCoverRequest_organizationId_idx" ON "ShiftCoverRequest"("organizationId");

-- CreateIndex
CREATE INDEX "ShiftCoverRequest_organizationId_status_idx" ON "ShiftCoverRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ShiftCoverRequest_shiftId_idx" ON "ShiftCoverRequest"("shiftId");

-- CreateIndex
CREATE INDEX "ShiftCoverRequest_requesterEmployeeId_idx" ON "ShiftCoverRequest"("requesterEmployeeId");

-- CreateIndex
CREATE INDEX "SuperAdminAudit_createdAt_idx" ON "SuperAdminAudit"("createdAt");

-- CreateIndex
CREATE INDEX "SuperAdminAudit_organizationId_idx" ON "SuperAdminAudit"("organizationId");

-- CreateIndex
CREATE INDEX "SuperAdminAudit_actorEmail_idx" ON "SuperAdminAudit"("actorEmail");

-- CreateIndex
CREATE INDEX "BugReport_organizationId_status_idx" ON "BugReport"("organizationId", "status");

-- CreateIndex
CREATE INDEX "BugReport_status_idx" ON "BugReport"("status");

-- CreateIndex
CREATE INDEX "BugReport_userId_idx" ON "BugReport"("userId");

-- CreateIndex
CREATE INDEX "Employee_userId_organizationId_idx" ON "Employee"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "Membership_userId_role_idx" ON "Membership"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_organizationId_weekStart_key" ON "Schedule"("organizationId", "weekStart");

-- CreateIndex
CREATE INDEX "TimeOffRequest_employeeId_status_idx" ON "TimeOffRequest"("employeeId", "status");

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftCoverRequest" ADD CONSTRAINT "ShiftCoverRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftCoverRequest" ADD CONSTRAINT "ShiftCoverRequest_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftCoverRequest" ADD CONSTRAINT "ShiftCoverRequest_requesterEmployeeId_fkey" FOREIGN KEY ("requesterEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftCoverRequest" ADD CONSTRAINT "ShiftCoverRequest_claimedByEmployeeId_fkey" FOREIGN KEY ("claimedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
