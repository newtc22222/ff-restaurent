-- Keep `address` as the display snapshot so existing rows and clients remain valid.
ALTER TABLE "RestaurantEntry"
ADD COLUMN "addressLine" TEXT,
ADD COLUMN "provinceCode" TEXT,
ADD COLUMN "provinceName" TEXT,
ADD COLUMN "wardCode" TEXT,
ADD COLUMN "wardName" TEXT;
