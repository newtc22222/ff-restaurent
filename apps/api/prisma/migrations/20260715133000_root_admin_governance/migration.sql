CREATE TYPE "SystemRole" AS ENUM ('ROOT_ADMIN');

ALTER TABLE "User"
  ADD COLUMN "systemRole" "SystemRole",
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "RootAdminTransferAudit" (
  "id" TEXT NOT NULL,
  "fromUserId" TEXT NOT NULL,
  "toUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RootAdminTransferAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_systemRole_key" ON "User"("systemRole");

ALTER TABLE "RootAdminTransferAudit"
  ADD CONSTRAINT "RootAdminTransferAudit_fromUserId_fkey"
  FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RootAdminTransferAudit"
  ADD CONSTRAINT "RootAdminTransferAudit_toUserId_fkey"
  FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
