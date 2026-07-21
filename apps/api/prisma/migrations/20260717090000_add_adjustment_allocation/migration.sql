CREATE TYPE "AdjustmentAllocation" AS ENUM ('EQUAL', 'PROPORTIONAL');

ALTER TABLE "Bill"
ADD COLUMN "adjustmentAllocation" "AdjustmentAllocation" NOT NULL DEFAULT 'EQUAL';

ALTER TABLE "Bill"
ALTER COLUMN "adjustmentAllocation" SET DEFAULT 'PROPORTIONAL';
