CREATE TYPE "NotificationCategory" AS ENUM ('PAYMENT_REMINDER', 'RESTAURANT_CREATED', 'COLLECTION_PUBLISHED', 'MEAL_VOTE_CREATED', 'MEAL_VOTE_CLOSING', 'MEAL_VOTE_RESULT');

CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TYPE "NotificationLocale" AS ENUM ('VI', 'EN');

ALTER TABLE "Notification"
ADD COLUMN "category" "NotificationCategory" NOT NULL DEFAULT 'PAYMENT_REMINDER',
ADD COLUMN "targetUrl" TEXT,
ADD COLUMN "actorId" TEXT,
ADD COLUMN "deduplicationKey" TEXT,
ADD COLUMN "data" JSONB,
ADD COLUMN "inAppVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "pushStatus" "NotificationDeliveryStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
ADD COLUMN "pushAttemptedAt" TIMESTAMP(3),
ADD COLUMN "pushSentAt" TIMESTAMP(3);

ALTER TABLE "PushSubscription"
ADD COLUMN "locale" "NotificationLocale" NOT NULL DEFAULT 'VI';

CREATE TABLE "NotificationPreference" (
  "userId" TEXT NOT NULL,
  "category" "NotificationCategory" NOT NULL,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId", "category")
);

CREATE UNIQUE INDEX "Notification_deduplicationKey_userId_key" ON "Notification"("deduplicationKey", "userId");
CREATE INDEX "Notification_actorId_createdAt_idx" ON "Notification"("actorId", "createdAt");
CREATE INDEX "Notification_category_createdAt_idx" ON "Notification"("category", "createdAt");

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NotificationPreference"
ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
