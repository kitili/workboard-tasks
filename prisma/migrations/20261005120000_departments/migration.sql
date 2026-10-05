ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "departmentSlug" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "departmentSlug" TEXT;

CREATE INDEX IF NOT EXISTS "User_departmentSlug_idx" ON "User"("departmentSlug");
CREATE INDEX IF NOT EXISTS "Task_organizationId_departmentSlug_idx" ON "Task"("organizationId", "departmentSlug");
