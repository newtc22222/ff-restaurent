-- Operator rollback for this migration. Audit timestamps were never rewritten,
-- so restoring the previous indexes and removing the additive date is enough.
DROP INDEX "Bill_status_occurredOn_createdAt_id_idx";
DROP INDEX "Bill_restaurantId_occurredOn_createdAt_id_idx";
DROP INDEX "Bill_createdById_occurredOn_createdAt_id_idx";

CREATE INDEX "Bill_status_createdAt_id_idx"
ON "Bill"("status", "createdAt", "id");

CREATE INDEX "Bill_restaurantId_createdAt_id_idx"
ON "Bill"("restaurantId", "createdAt", "id");

CREATE INDEX "Bill_createdById_createdAt_id_idx"
ON "Bill"("createdById", "createdAt", "id");

ALTER TABLE "Bill"
DROP COLUMN "occurredOn";
