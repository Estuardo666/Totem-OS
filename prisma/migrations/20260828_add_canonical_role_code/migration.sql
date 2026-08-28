-- CP05: canonical role source. Keep legacy `role` for dual-read/write.
ALTER TABLE "User"
  ADD COLUMN "role_code" TEXT NOT NULL DEFAULT 'EDITOR';

-- Unknown legacy values are downgraded to USER, never upgraded to EDITOR.
UPDATE "User"
SET "role_code" = CASE UPPER(TRIM("role"))
  WHEN 'ADMIN' THEN 'ADMIN'
  WHEN 'EDITOR' THEN 'EDITOR'
  WHEN 'USER' THEN 'USER'
  ELSE 'USER'
END;

CREATE INDEX "User_role_code_idx" ON "User"("role_code");
