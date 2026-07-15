CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "User" ADD COLUMN "searchText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "RestaurantEntry" ADD COLUMN "searchText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Cuisine" ADD COLUMN "searchText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DiningArea" ADD COLUMN "searchText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Collection" ADD COLUMN "searchText" TEXT NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION ff_normalize_search(value TEXT)
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$ SELECT lower(unaccent(coalesce(value, ''))) $$;

CREATE OR REPLACE FUNCTION ff_refresh_search_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'User' THEN
    NEW."searchText" := ff_normalize_search(NEW."name" || ' ' || NEW."username");
  ELSIF TG_TABLE_NAME = 'RestaurantEntry' THEN
    NEW."searchText" := ff_normalize_search(NEW."name" || ' ' || NEW."address" || ' ' || NEW."cuisineType" || ' ' || NEW."type");
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

CREATE TRIGGER "User_search_text_trigger"
BEFORE INSERT OR UPDATE OF "name", "username" ON "User"
FOR EACH ROW EXECUTE FUNCTION ff_refresh_search_text();
CREATE TRIGGER "RestaurantEntry_search_text_trigger"
BEFORE INSERT OR UPDATE OF "name", "address", "cuisineType", "type" ON "RestaurantEntry"
FOR EACH ROW EXECUTE FUNCTION ff_refresh_search_text();
CREATE TRIGGER "Cuisine_search_text_trigger"
BEFORE INSERT OR UPDATE OF "name", "type", "description" ON "Cuisine"
FOR EACH ROW EXECUTE FUNCTION ff_refresh_search_text();
CREATE TRIGGER "DiningArea_search_text_trigger"
BEFORE INSERT OR UPDATE OF "name", "address", "description" ON "DiningArea"
FOR EACH ROW EXECUTE FUNCTION ff_refresh_search_text();
CREATE TRIGGER "Collection_search_text_trigger"
BEFORE INSERT OR UPDATE OF "name", "description" ON "Collection"
FOR EACH ROW EXECUTE FUNCTION ff_refresh_search_text();

UPDATE "User" SET "searchText" = ff_normalize_search("name" || ' ' || "username");
UPDATE "RestaurantEntry" SET "searchText" = ff_normalize_search("name" || ' ' || "address" || ' ' || "cuisineType" || ' ' || "type");
UPDATE "Cuisine" SET "searchText" = ff_normalize_search("name" || ' ' || "type" || ' ' || coalesce("description", ''));
UPDATE "DiningArea" SET "searchText" = ff_normalize_search("name" || ' ' || "address" || ' ' || coalesce("description", ''));
UPDATE "Collection" SET "searchText" = ff_normalize_search("name" || ' ' || coalesce("description", ''));

CREATE INDEX "User_searchText_trgm_idx" ON "User" USING GIN ("searchText" gin_trgm_ops);
CREATE INDEX "RestaurantEntry_searchText_trgm_idx" ON "RestaurantEntry" USING GIN ("searchText" gin_trgm_ops);
CREATE INDEX "Cuisine_searchText_trgm_idx" ON "Cuisine" USING GIN ("searchText" gin_trgm_ops);
CREATE INDEX "DiningArea_searchText_trgm_idx" ON "DiningArea" USING GIN ("searchText" gin_trgm_ops);
CREATE INDEX "Collection_searchText_trgm_idx" ON "Collection" USING GIN ("searchText" gin_trgm_ops);

CREATE INDEX "Bill_status_createdAt_id_idx" ON "Bill"("status", "createdAt", "id");
CREATE INDEX "Bill_restaurantId_createdAt_id_idx" ON "Bill"("restaurantId", "createdAt", "id");
CREATE INDEX "Bill_createdById_createdAt_id_idx" ON "Bill"("createdById", "createdAt", "id");
CREATE INDEX "BillParticipant_memberId_paymentStatus_billId_idx" ON "BillParticipant"("memberId", "paymentStatus", "billId");
CREATE INDEX "BillParticipant_paymentStatus_billId_idx" ON "BillParticipant"("paymentStatus", "billId");
CREATE INDEX "RestaurantEntry_status_createdAt_id_idx" ON "RestaurantEntry"("status", "createdAt", "id");
CREATE INDEX "RestaurantEntry_createdById_createdAt_id_idx" ON "RestaurantEntry"("createdById", "createdAt", "id");
CREATE INDEX "RestaurantEntry_isRecommended_status_createdAt_id_idx" ON "RestaurantEntry"("isRecommended", "status", "createdAt", "id");
