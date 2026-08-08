ALTER TABLE "BillParticipant"
ADD COLUMN "sponsoredById" TEXT;

CREATE INDEX "BillParticipant_sponsoredById_billId_idx"
ON "BillParticipant"("sponsoredById", "billId");

ALTER TABLE "BillParticipant"
ADD CONSTRAINT "BillParticipant_sponsoredById_fkey"
FOREIGN KEY ("sponsoredById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
