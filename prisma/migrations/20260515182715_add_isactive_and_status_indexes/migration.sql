-- CreateIndex
CREATE INDEX "AvailabilityRequest_organizationId_status_idx" ON "AvailabilityRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Employee_organizationId_isActive_idx" ON "Employee"("organizationId", "isActive");
