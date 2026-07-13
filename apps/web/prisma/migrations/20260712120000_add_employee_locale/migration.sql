-- Per-employee message language ("da", "en", or a full BCP 47 tag).
-- Falls back to the organization's locale when null.
ALTER TABLE "Employee" ADD COLUMN "locale" TEXT;
