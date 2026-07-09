-- Migration: rename Cents fields, replace email with phone/username, add new tables/columns

-- ============================================================
-- User: drop email, add username + phone
-- ============================================================
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "phone" TEXT;

-- Backfill username from email (strip @domain)
UPDATE "User" SET "username" = SPLIT_PART("email", '@', 1);

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

ALTER TABLE "User" DROP COLUMN "email";
DROP INDEX IF EXISTS "User_email_key";

-- ============================================================
-- RestaurantEntry: add avatarUrl, links
-- ============================================================
ALTER TABLE "RestaurantEntry" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "RestaurantEntry" ADD COLUMN "links" JSONB NOT NULL DEFAULT '[]';

-- ============================================================
-- Bill: rename Cents fields, add qrCodePath
-- ============================================================
ALTER TABLE "Bill" RENAME COLUMN "baseCostCents" TO "baseCost";
ALTER TABLE "Bill" RENAME COLUMN "vatCents" TO "vat";
ALTER TABLE "Bill" RENAME COLUMN "shippingFeeCents" TO "shippingFee";
ALTER TABLE "Bill" RENAME COLUMN "totalCostCents" TO "totalCost";
ALTER TABLE "Bill" ADD COLUMN "qrCodePath" TEXT;

-- ============================================================
-- BillParticipant: rename Cents fields
-- ============================================================
ALTER TABLE "BillParticipant" RENAME COLUMN "originCostCents" TO "originCost";
ALTER TABLE "BillParticipant" RENAME COLUMN "allocatedVatCents" TO "allocatedVat";
ALTER TABLE "BillParticipant" RENAME COLUMN "allocatedShippingCents" TO "allocatedShipping";
ALTER TABLE "BillParticipant" RENAME COLUMN "discountAppliedCents" TO "discountApplied";
ALTER TABLE "BillParticipant" RENAME COLUMN "finalPriceCents" TO "finalPrice";

-- ============================================================
-- UserFavorite: new junction table
-- ============================================================
CREATE TABLE "UserFavorite" (
  "userId" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserFavorite_pkey" PRIMARY KEY ("userId","restaurantId")
);

ALTER TABLE "UserFavorite" ADD CONSTRAINT "UserFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserFavorite" ADD CONSTRAINT "UserFavorite_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "RestaurantEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
