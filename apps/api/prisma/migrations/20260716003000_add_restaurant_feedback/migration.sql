CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "foodRating" DECIMAL(3,1) NOT NULL,
    "serviceRating" DECIMAL(3,1) NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Feedback_foodRating_bounds_check"
      CHECK ("foodRating" >= 1 AND "foodRating" <= 10 AND MOD("foodRating" * 2, 1) = 0),
    CONSTRAINT "Feedback_serviceRating_bounds_check"
      CHECK ("serviceRating" >= 1 AND "serviceRating" <= 10 AND MOD("serviceRating" * 2, 1) = 0)
);

CREATE UNIQUE INDEX "Feedback_billId_userId_key" ON "Feedback"("billId", "userId");
CREATE INDEX "Feedback_restaurantId_createdAt_id_idx" ON "Feedback"("restaurantId", "createdAt", "id");
CREATE INDEX "Feedback_userId_createdAt_idx" ON "Feedback"("userId", "createdAt");

ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_billId_fkey"
  FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "RestaurantEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
