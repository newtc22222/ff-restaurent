ALTER TABLE "DiningArea"
DROP CONSTRAINT IF EXISTS "DiningArea_defaultImageId_fkey";

ALTER TABLE "DiningAreaImage"
DROP CONSTRAINT IF EXISTS "DiningAreaImage_diningAreaId_fkey";

DROP INDEX IF EXISTS "DiningArea_defaultImageId_idx";
DROP INDEX IF EXISTS "DiningArea_defaultImageId_key";

ALTER TABLE "DiningArea"
DROP COLUMN IF EXISTS "defaultImageId";

DROP TABLE IF EXISTS "DiningAreaImage";
