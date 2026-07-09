CREATE TYPE "ChefRole" AS ENUM ('SOUS_CHEF', 'HEAD_CHEF');
CREATE TYPE "EntryStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'WAITING');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "chefRole" "ChefRole",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RestaurantEntry" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "cuisineType" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "isRecommended" BOOLEAN NOT NULL DEFAULT false,
  "isFavorite" BOOLEAN NOT NULL DEFAULT false,
  "status" "EntryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RestaurantEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Bill" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "baseCostCents" INTEGER NOT NULL,
  "vatCents" INTEGER NOT NULL,
  "shippingFeeCents" INTEGER NOT NULL,
  "discounts" JSONB NOT NULL DEFAULT '[]',
  "vouchers" JSONB NOT NULL DEFAULT '[]',
  "totalCostCents" INTEGER NOT NULL,
  "status" "EntryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillParticipant" (
  "billId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "originCostCents" INTEGER NOT NULL,
  "allocatedVatCents" INTEGER NOT NULL,
  "allocatedShippingCents" INTEGER NOT NULL,
  "discountAppliedCents" INTEGER NOT NULL,
  "finalPriceCents" INTEGER NOT NULL,
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'WAITING',
  "paidAt" TIMESTAMP(3),
  CONSTRAINT "BillParticipant_pkey" PRIMARY KEY ("billId","memberId")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "billId" TEXT,
  "message" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoleAuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "changedById" TEXT NOT NULL,
  "fromRole" "ChefRole",
  "toRole" "ChefRole",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoleAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillAuditLog" (
  "id" TEXT NOT NULL,
  "billId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
ALTER TABLE "RestaurantEntry" ADD CONSTRAINT "RestaurantEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "RestaurantEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillParticipant" ADD CONSTRAINT "BillParticipant_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillParticipant" ADD CONSTRAINT "BillParticipant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleAuditLog" ADD CONSTRAINT "RoleAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoleAuditLog" ADD CONSTRAINT "RoleAuditLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillAuditLog" ADD CONSTRAINT "BillAuditLog_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillAuditLog" ADD CONSTRAINT "BillAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
