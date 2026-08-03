ALTER TABLE "User"
ALTER COLUMN "primaryColor" SET DEFAULT '#3b82f6';

UPDATE "User"
SET "primaryColor" = '#3b82f6'
WHERE "themeId" = 'default'
  AND "darkMode" = FALSE
  AND LOWER("primaryColor") = '#27221f';
