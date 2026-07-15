CREATE TYPE "RestaurantPlatform" AS ENUM (
  'GRAB',
  'SHOPEE_FOOD',
  'BE_FOOD',
  'GOJEK',
  'WEBSITE',
  'FACEBOOK',
  'OTHER'
);

ALTER TABLE "RestaurantEntry"
ADD COLUMN "phone" TEXT,
ADD COLUMN "bannerImageUrl" TEXT;

CREATE TABLE "RestaurantPlatformLink" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "platform" "RestaurantPlatform" NOT NULL,
  "label" TEXT,
  "url" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "RestaurantPlatformLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RestaurantPlatformLink_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "RestaurantEntry"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Fail explicitly instead of silently dropping duplicate legacy links.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "RestaurantEntry" restaurant,
      jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(restaurant."links") = 'array' THEN restaurant."links"
          ELSE '[]'::jsonb
        END
      ) link
    WHERE NULLIF(BTRIM(link->>'url'), '') IS NOT NULL
    GROUP BY restaurant."id", LOWER(BTRIM(link->>'url'))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate legacy restaurant platform URLs must be resolved before migration';
  END IF;
END $$;

INSERT INTO "RestaurantPlatformLink" (
  "id",
  "restaurantId",
  "platform",
  "label",
  "url",
  "sortOrder"
)
SELECT
  'legacy_' || md5(restaurant."id" || ':' || link.ordinality::text),
  restaurant."id",
  'OTHER'::"RestaurantPlatform",
  COALESCE(NULLIF(BTRIM(link.value->>'label'), ''), 'Legacy link'),
  BTRIM(link.value->>'url'),
  link.ordinality::integer - 1
FROM "RestaurantEntry" restaurant
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof(restaurant."links") = 'array' THEN restaurant."links"
    ELSE '[]'::jsonb
  END
) WITH ORDINALITY AS link(value, ordinality)
WHERE NULLIF(BTRIM(link.value->>'url'), '') IS NOT NULL;

CREATE UNIQUE INDEX "RestaurantPlatformLink_restaurantId_url_key"
ON "RestaurantPlatformLink"("restaurantId", "url");
CREATE UNIQUE INDEX "RestaurantPlatformLink_restaurantId_normalized_url_key"
ON "RestaurantPlatformLink"("restaurantId", LOWER("url"));
CREATE UNIQUE INDEX "RestaurantPlatformLink_restaurantId_sortOrder_key"
ON "RestaurantPlatformLink"("restaurantId", "sortOrder");
CREATE UNIQUE INDEX "RestaurantPlatformLink_named_platform_key"
ON "RestaurantPlatformLink"("restaurantId", "platform")
WHERE "platform" <> 'OTHER';
CREATE INDEX "RestaurantPlatformLink_restaurantId_platform_idx"
ON "RestaurantPlatformLink"("restaurantId", "platform");
