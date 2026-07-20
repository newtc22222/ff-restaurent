-- Phase 2 contract migration. Refuse to remove legacy data until every
-- normalized invariant and equivalence check is proven in the same transaction.
INSERT INTO "Collection" (
  "id", "name", "isPublic", "systemType", "ownerId", "createdAt", "updatedAt"
)
SELECT
  'system-recommended', 'Recommended', true, 'RECOMMENDED', NULL,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "User")
  AND NOT EXISTS (SELECT 1 FROM "RestaurantEntry")
  AND NOT EXISTS (SELECT 1 FROM "Collection");

DO $$
DECLARE
  violation_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO violation_count
  FROM "RestaurantEntry" restaurant
  WHERE (SELECT COUNT(*) FROM "RestaurantCuisine" cuisine
         WHERE cuisine."restaurantId" = restaurant."id" AND cuisine."isPrimary") <> 1;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'phase2 contract blocked: % restaurants do not have exactly one primary cuisine', violation_count;
  END IF;

  SELECT COUNT(*) INTO violation_count
  FROM "User" user_record
  WHERE (SELECT COUNT(*) FROM "Collection" collection
         WHERE collection."ownerId" = user_record."id"
           AND collection."systemType" = 'FAVORITES') <> 1;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'phase2 contract blocked: % users do not have exactly one Favorites collection', violation_count;
  END IF;

  SELECT ABS(COUNT(*) - 1) INTO violation_count
  FROM "Collection" WHERE "systemType" = 'RECOMMENDED';
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'phase2 contract blocked: exactly one Recommended collection is required';
  END IF;

  SELECT COUNT(*) INTO violation_count
  FROM "UserFavorite" favorite
  WHERE NOT EXISTS (
    SELECT 1 FROM "CollectionRestaurant" membership
    JOIN "Collection" collection ON collection."id" = membership."collectionId"
    WHERE membership."restaurantId" = favorite."restaurantId"
      AND collection."ownerId" = favorite."userId"
      AND collection."systemType" = 'FAVORITES'
  );
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'phase2 contract blocked: % legacy favorites lack normalized memberships', violation_count;
  END IF;

  SELECT COUNT(*) INTO violation_count
  FROM "RestaurantEntry" restaurant
  WHERE restaurant."isRecommended"
    AND NOT EXISTS (
      SELECT 1 FROM "CollectionRestaurant" membership
      JOIN "Collection" collection ON collection."id" = membership."collectionId"
      WHERE membership."restaurantId" = restaurant."id"
        AND collection."systemType" = 'RECOMMENDED'
    );
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'phase2 contract blocked: % legacy recommendations lack normalized memberships', violation_count;
  END IF;

  SELECT COUNT(*) INTO violation_count
  FROM "RestaurantEntry" restaurant
  WHERE restaurant."isFavorite"
    AND NOT EXISTS (
      SELECT 1 FROM "CollectionRestaurant" membership
      JOIN "Collection" collection ON collection."id" = membership."collectionId"
      WHERE membership."restaurantId" = restaurant."id"
        AND collection."systemType" = 'RECOMMENDED'
    );
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'phase2 contract blocked: % ownerless favorite flags lack normalized Recommended memberships', violation_count;
  END IF;

  SELECT COUNT(*) INTO violation_count
  FROM "RestaurantEntry" restaurant
  CROSS JOIN LATERAL jsonb_array_elements(restaurant."links") legacy_link
  WHERE jsonb_typeof(restaurant."links") = 'array'
    AND coalesce(legacy_link->>'url', '') <> ''
    AND NOT EXISTS (
      SELECT 1 FROM "RestaurantPlatformLink" platform_link
      WHERE platform_link."restaurantId" = restaurant."id"
        AND platform_link."url" = legacy_link->>'url'
    );
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'phase2 contract blocked: % legacy links lack normalized platform links', violation_count;
  END IF;
END $$;

DROP TRIGGER "RestaurantEntry_search_text_trigger" ON "RestaurantEntry";

CREATE OR REPLACE FUNCTION ff_refresh_search_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'User' THEN
    NEW."searchText" := ff_normalize_search(NEW."name" || ' ' || NEW."username");
  ELSIF TG_TABLE_NAME = 'RestaurantEntry' THEN
    NEW."searchText" := ff_normalize_search(NEW."name" || ' ' || NEW."address" || ' ' || NEW."type");
  ELSIF TG_TABLE_NAME = 'Cuisine' THEN
    NEW."searchText" := ff_normalize_search(NEW."name" || ' ' || NEW."type" || ' ' || coalesce(NEW."description", ''));
  ELSIF TG_TABLE_NAME = 'DiningArea' THEN
    NEW."searchText" := ff_normalize_search(NEW."name" || ' ' || NEW."address" || ' ' || coalesce(NEW."description", ''));
  ELSIF TG_TABLE_NAME = 'Collection' THEN
    NEW."searchText" := ff_normalize_search(NEW."name" || ' ' || coalesce(NEW."description", ''));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "RestaurantEntry_search_text_trigger"
BEFORE INSERT OR UPDATE OF "name", "address", "type" ON "RestaurantEntry"
FOR EACH ROW EXECUTE FUNCTION ff_refresh_search_text();

UPDATE "RestaurantEntry"
SET "searchText" = ff_normalize_search("name" || ' ' || "address" || ' ' || "type");

DROP INDEX "RestaurantEntry_isRecommended_status_createdAt_id_idx";
DROP TABLE "UserFavorite";
ALTER TABLE "RestaurantEntry"
  DROP COLUMN "cuisineType",
  DROP COLUMN "links",
  DROP COLUMN "isFavorite",
  DROP COLUMN "isRecommended";
