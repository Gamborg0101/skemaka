-- Throwaway "try the live demo" sandbox orgs: created per visitor, auto-deleted
-- by the cleanup cron 48h after creation, excluded from platform metrics.
ALTER TABLE "Organization" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Organization_isDemo_createdAt_idx" ON "Organization"("isDemo", "createdAt");
