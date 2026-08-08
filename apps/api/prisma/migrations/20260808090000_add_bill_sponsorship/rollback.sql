ALTER TABLE "BillParticipant"
DROP CONSTRAINT "BillParticipant_sponsoredById_fkey";

DROP INDEX "BillParticipant_sponsoredById_billId_idx";

ALTER TABLE "BillParticipant"
DROP COLUMN "sponsoredById";
