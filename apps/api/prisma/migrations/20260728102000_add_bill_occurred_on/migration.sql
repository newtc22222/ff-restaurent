-- Add the business date independently from immutable audit timestamps.
ALTER TABLE "Bill"
ADD COLUMN "occurredOn" DATE;

-- PostgreSQL stores createdAt as timestamp without time zone. Interpret that
-- historical instant as UTC, then take its Ho Chi Minh calendar date.
UPDATE "Bill"
SET "occurredOn" = (
  "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh'
)::date;

ALTER TABLE "Bill"
ALTER COLUMN "occurredOn" SET NOT NULL,
ALTER COLUMN "occurredOn" SET DEFAULT (
  CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh'
)::date;

DROP INDEX "Bill_status_createdAt_id_idx";
DROP INDEX "Bill_restaurantId_createdAt_id_idx";
DROP INDEX "Bill_createdById_createdAt_id_idx";

CREATE INDEX "Bill_status_occurredOn_createdAt_id_idx"
ON "Bill"("status", "occurredOn", "createdAt", "id");

CREATE INDEX "Bill_restaurantId_occurredOn_createdAt_id_idx"
ON "Bill"("restaurantId", "occurredOn", "createdAt", "id");

CREATE INDEX "Bill_createdById_occurredOn_createdAt_id_idx"
ON "Bill"("createdById", "occurredOn", "createdAt", "id");

-- Rollback is lossless for pre-migration data because createdAt/updatedAt are
-- untouched: recreate the three former indexes, then drop occurredOn.
