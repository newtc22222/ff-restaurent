CREATE TABLE "Cuisine" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameKey" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Cuisine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiningArea" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedKey" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "addressLine" TEXT,
  "provinceCode" TEXT,
  "provinceName" TEXT,
  "wardCode" TEXT,
  "wardName" TEXT,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiningArea_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RestaurantCuisine" (
  "restaurantId" TEXT NOT NULL,
  "cuisineId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "RestaurantCuisine_pkey" PRIMARY KEY ("restaurantId", "cuisineId"),
  CONSTRAINT "RestaurantCuisine_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "RestaurantEntry"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RestaurantCuisine_cuisineId_fkey"
    FOREIGN KEY ("cuisineId") REFERENCES "Cuisine"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "RestaurantEntry" ADD COLUMN "diningAreaId" TEXT;
ALTER TABLE "RestaurantEntry" ADD CONSTRAINT "RestaurantEntry_diningAreaId_fkey"
  FOREIGN KEY ("diningAreaId") REFERENCES "DiningArea"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Cuisine_nameKey_key" ON "Cuisine"("nameKey");
CREATE UNIQUE INDEX "DiningArea_normalizedKey_key" ON "DiningArea"("normalizedKey");
CREATE INDEX "RestaurantCuisine_cuisineId_idx" ON "RestaurantCuisine"("cuisineId");
CREATE UNIQUE INDEX "RestaurantCuisine_one_primary_key"
  ON "RestaurantCuisine"("restaurantId") WHERE "isPrimary" = true;
CREATE INDEX "RestaurantEntry_diningAreaId_idx" ON "RestaurantEntry"("diningAreaId");

-- Expand/backfill: preserve cuisineType while creating one primary normalized join.
INSERT INTO "Cuisine" ("id", "name", "nameKey", "type", "updatedAt")
SELECT
  'legacy_' || md5(source."nameKey"),
  MIN(source."name"),
  source."nameKey",
  'Legacy',
  CURRENT_TIMESTAMP
FROM (
  SELECT
    CASE
      WHEN BTRIM("cuisineType") = '' THEN 'Uncategorized'
      ELSE REGEXP_REPLACE(BTRIM("cuisineType"), '[[:space:]]+', ' ', 'g')
    END AS "name",
    LOWER(
      REGEXP_REPLACE(
        CASE
          WHEN BTRIM("cuisineType") = '' THEN 'Uncategorized'
          ELSE BTRIM("cuisineType")
        END,
        '[[:space:]]+',
        ' ',
        'g'
      )
    ) AS "nameKey"
  FROM "RestaurantEntry"
) source
GROUP BY source."nameKey";

INSERT INTO "RestaurantCuisine" ("restaurantId", "cuisineId", "isPrimary")
SELECT
  restaurant."id",
  cuisine."id",
  true
FROM "RestaurantEntry" restaurant
JOIN "Cuisine" cuisine ON cuisine."nameKey" = LOWER(
  REGEXP_REPLACE(
    CASE
      WHEN BTRIM(restaurant."cuisineType") = '' THEN 'Uncategorized'
      ELSE BTRIM(restaurant."cuisineType")
    END,
    '[[:space:]]+',
    ' ',
    'g'
  )
);
