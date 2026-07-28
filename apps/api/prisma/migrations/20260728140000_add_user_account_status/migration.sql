CREATE TYPE "UserAccountStatus" AS ENUM ('ACTIVE', 'BLOCKED');

ALTER TABLE "User"
ADD COLUMN "accountStatus" "UserAccountStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE "UserAccountStatusAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "fromStatus" "UserAccountStatus" NOT NULL,
    "toStatus" "UserAccountStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAccountStatusAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserAccountStatusAudit_userId_createdAt_idx"
ON "UserAccountStatusAudit"("userId", "createdAt");

CREATE INDEX "UserAccountStatusAudit_changedById_createdAt_idx"
ON "UserAccountStatusAudit"("changedById", "createdAt");

ALTER TABLE "UserAccountStatusAudit"
ADD CONSTRAINT "UserAccountStatusAudit_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserAccountStatusAudit"
ADD CONSTRAINT "UserAccountStatusAudit_changedById_fkey"
FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
