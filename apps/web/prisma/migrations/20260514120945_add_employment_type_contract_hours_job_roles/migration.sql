-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'REDUCED_FULL_TIME', 'PART_TIME');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "contractedHours" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "employmentType" "EmploymentType" NOT NULL DEFAULT 'PART_TIME';

-- CreateTable
CREATE TABLE "JobRole" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobRole_organizationId_idx" ON "JobRole"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "JobRole_organizationId_name_key" ON "JobRole"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "JobRole" ADD CONSTRAINT "JobRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
