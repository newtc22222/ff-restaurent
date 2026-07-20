#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
psql_url="$(printf '%s' "$DATABASE_URL" | sed -E 's/([?&])schema=[^&]*(&|$)/\1/; s/\?&/?/; s/[?&]$//')"
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
migrations_dir="$root_dir/apps/api/prisma/migrations"
contract_migration="$migrations_dir/20260720000000_contract_phase2_normalized_restaurants/migration.sql"

# This script runs only against the disposable CI/test database. Keep shared
# extension functions in public so each isolated schema sees the same functions.
psql "$psql_url" --no-psqlrc --set ON_ERROR_STOP=1 <<'SQL' >/dev/null
DROP EXTENSION IF EXISTS unaccent CASCADE;
DROP EXTENSION IF EXISTS pg_trgm CASCADE;
CREATE EXTENSION unaccent WITH SCHEMA public;
CREATE EXTENSION pg_trgm WITH SCHEMA public;
SQL

psql_schema() {
  local schema="$1"
  shift
  PGOPTIONS="-c search_path=$schema,public" psql "$psql_url" --no-psqlrc --set ON_ERROR_STOP=1 "$@"
}

prepare_rc_schema() {
  local schema="$1"
  psql "$psql_url" --no-psqlrc --set ON_ERROR_STOP=1 <<SQL
DROP SCHEMA IF EXISTS "$schema" CASCADE;
CREATE SCHEMA "$schema";
SQL
  while IFS= read -r migration; do
    psql_schema "$schema" --file "$migration" >/dev/null
  done < <(find "$migrations_dir" -mindepth 2 -maxdepth 2 -name migration.sql ! -path "*/20260720000000_contract_phase2_normalized_restaurants/*" | sort)
  psql_schema "$schema" <<'SQL' >/dev/null
INSERT INTO "User" ("id", "username", "name", "passwordHash", "updatedAt")
VALUES ('contract-user', 'contract-user', 'Contract User', 'hash', CURRENT_TIMESTAMP);
INSERT INTO "Cuisine" ("id", "name", "nameKey", "type", "updatedAt")
VALUES ('contract-cuisine', 'Vietnamese', 'vietnamese', 'Regional', CURRENT_TIMESTAMP);
INSERT INTO "RestaurantEntry" (
  "id", "name", "address", "cuisineType", "type", "links",
  "isFavorite", "isRecommended", "createdById", "updatedAt"
) VALUES (
  'contract-restaurant', 'Contract Restaurant', '1 Contract Street',
  'Vietnamese', 'Restaurant', '[{"label":"Menu","url":"https://example.test/menu"}]',
  true, true, 'contract-user', CURRENT_TIMESTAMP
);
INSERT INTO "RestaurantCuisine" ("restaurantId", "cuisineId", "isPrimary")
VALUES ('contract-restaurant', 'contract-cuisine', true);
INSERT INTO "Collection" (
  "id", "name", "isPublic", "systemType", "ownerId", "updatedAt"
) VALUES
  ('contract-favorites', 'Favorites', false, 'FAVORITES', 'contract-user', CURRENT_TIMESTAMP),
  ('contract-recommended', 'Recommended', true, 'RECOMMENDED', NULL, CURRENT_TIMESTAMP);
INSERT INTO "CollectionRestaurant" ("collectionId", "restaurantId") VALUES
  ('contract-favorites', 'contract-restaurant'),
  ('contract-recommended', 'contract-restaurant');
INSERT INTO "UserFavorite" ("userId", "restaurantId")
VALUES ('contract-user', 'contract-restaurant');
INSERT INTO "RestaurantPlatformLink" (
  "id", "restaurantId", "platform", "label", "url", "sortOrder"
) VALUES (
  'contract-link', 'contract-restaurant', 'WEBSITE', 'Menu',
  'https://example.test/menu', 0
);
SQL
}

expect_blocked() {
  local schema="$1"
  local expected="$2"
  local output
  if output="$(psql_schema "$schema" --file "$contract_migration" 2>&1)"; then
    echo "Expected contract migration to fail for $schema" >&2
    exit 1
  fi
  if [[ "$output" != *"$expected"* ]]; then
    echo "$output" >&2
    echo "Contract failure for $schema did not contain: $expected" >&2
    exit 1
  fi
}

prepare_rc_schema contract_success
psql_schema contract_success --file "$contract_migration" >/dev/null
psql_schema contract_success --tuples-only --no-align <<'SQL' | grep -qx '0|0|0'
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = 'contract_success' AND table_name = 'RestaurantEntry'
     AND column_name IN ('cuisineType', 'links', 'isFavorite', 'isRecommended'))
  || '|' ||
  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = 'contract_success' AND table_name = 'UserFavorite')
  || '|' ||
  (SELECT COUNT(*) FROM "RestaurantEntry" restaurant
   WHERE (SELECT COUNT(*) FROM "RestaurantCuisine" cuisine
          WHERE cuisine."restaurantId" = restaurant."id" AND cuisine."isPrimary") <> 1);
SQL

prepare_rc_schema contract_no_primary
psql_schema contract_no_primary --command='DELETE FROM "RestaurantCuisine";' >/dev/null
expect_blocked contract_no_primary 'restaurants do not have exactly one primary cuisine'

prepare_rc_schema contract_no_favorites
psql_schema contract_no_favorites --command="DELETE FROM \"Collection\" WHERE \"systemType\" = 'FAVORITES';" >/dev/null
expect_blocked contract_no_favorites 'users do not have exactly one Favorites collection'

prepare_rc_schema contract_no_recommended
psql_schema contract_no_recommended --command="DELETE FROM \"Collection\" WHERE \"systemType\" = 'RECOMMENDED';" >/dev/null
expect_blocked contract_no_recommended 'exactly one Recommended collection is required'

prepare_rc_schema contract_missing_favorite
psql_schema contract_missing_favorite --command="DELETE FROM \"CollectionRestaurant\" WHERE \"collectionId\" = 'contract-favorites';" >/dev/null
expect_blocked contract_missing_favorite 'legacy favorites lack normalized memberships'

prepare_rc_schema contract_missing_recommendation
psql_schema contract_missing_recommendation --command="DELETE FROM \"CollectionRestaurant\" WHERE \"collectionId\" = 'contract-recommended';" >/dev/null
psql_schema contract_missing_recommendation --command='UPDATE "RestaurantEntry" SET "isFavorite" = false;' >/dev/null
expect_blocked contract_missing_recommendation 'legacy recommendations lack normalized memberships'

prepare_rc_schema contract_missing_ownerless_favorite
psql_schema contract_missing_ownerless_favorite --command="DELETE FROM \"CollectionRestaurant\" WHERE \"collectionId\" = 'contract-recommended';" >/dev/null
psql_schema contract_missing_ownerless_favorite --command='UPDATE "RestaurantEntry" SET "isRecommended" = false;' >/dev/null
expect_blocked contract_missing_ownerless_favorite 'ownerless favorite flags lack normalized Recommended memberships'

prepare_rc_schema contract_missing_link
psql_schema contract_missing_link --command='DELETE FROM "RestaurantPlatformLink";' >/dev/null
expect_blocked contract_missing_link 'legacy links lack normalized platform links'

echo 'Phase 2 RC upgrade and fail-closed contract migration checks passed'
