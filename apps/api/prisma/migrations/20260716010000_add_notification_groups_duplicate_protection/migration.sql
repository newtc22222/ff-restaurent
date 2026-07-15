ALTER TABLE "User"
  ADD COLUMN "paymentRemindersEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Bill"
  ADD COLUMN "duplicateFingerprint" TEXT;

CREATE INDEX "Bill_createdById_duplicateFingerprint_status_idx"
  ON "Bill"("createdById", "duplicateFingerprint", "status");

CREATE TABLE "ParticipantGroup" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ParticipantGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ParticipantGroupMember" (
  "groupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParticipantGroupMember_pkey" PRIMARY KEY ("groupId", "userId")
);

CREATE UNIQUE INDEX "ParticipantGroup_ownerId_name_key"
  ON "ParticipantGroup"("ownerId", "name");
CREATE INDEX "ParticipantGroup_ownerId_updatedAt_idx"
  ON "ParticipantGroup"("ownerId", "updatedAt");
CREATE INDEX "ParticipantGroupMember_userId_idx"
  ON "ParticipantGroupMember"("userId");

ALTER TABLE "ParticipantGroup" ADD CONSTRAINT "ParticipantGroup_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParticipantGroupMember" ADD CONSTRAINT "ParticipantGroupMember_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "ParticipantGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParticipantGroupMember" ADD CONSTRAINT "ParticipantGroupMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
