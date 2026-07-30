DROP TABLE "UserAccountStatusAudit";

ALTER TABLE "User"
DROP COLUMN "accountStatus";

DROP TYPE "UserAccountStatus";
