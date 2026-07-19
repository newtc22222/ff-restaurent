ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;

CREATE TABLE "PaymentQrImage" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentQrImage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Bill" ADD COLUMN "paymentQrImageId" TEXT;

CREATE UNIQUE INDEX "PaymentQrImage_storagePath_key" ON "PaymentQrImage"("storagePath");
CREATE INDEX "PaymentQrImage_ownerId_status_createdAt_id_idx" ON "PaymentQrImage"("ownerId", "status", "createdAt", "id");
CREATE INDEX "Bill_paymentQrImageId_idx" ON "Bill"("paymentQrImageId");

ALTER TABLE "PaymentQrImage" ADD CONSTRAINT "PaymentQrImage_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_paymentQrImageId_fkey"
  FOREIGN KEY ("paymentQrImageId") REFERENCES "PaymentQrImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
