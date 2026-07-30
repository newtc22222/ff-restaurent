CREATE TABLE "DiningAreaImage" (
    "id" TEXT NOT NULL,
    "diningAreaId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiningAreaImage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DiningArea" ADD COLUMN "defaultImageId" TEXT;

CREATE UNIQUE INDEX "DiningAreaImage_storagePath_key" ON "DiningAreaImage"("storagePath");
CREATE UNIQUE INDEX "DiningAreaImage_diningAreaId_sortOrder_key" ON "DiningAreaImage"("diningAreaId", "sortOrder");
CREATE INDEX "DiningAreaImage_diningAreaId_createdAt_idx" ON "DiningAreaImage"("diningAreaId", "createdAt");
CREATE UNIQUE INDEX "DiningArea_defaultImageId_key" ON "DiningArea"("defaultImageId");
CREATE INDEX "DiningArea_defaultImageId_idx" ON "DiningArea"("defaultImageId");

ALTER TABLE "DiningAreaImage"
ADD CONSTRAINT "DiningAreaImage_diningAreaId_fkey"
FOREIGN KEY ("diningAreaId") REFERENCES "DiningArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiningArea"
ADD CONSTRAINT "DiningArea_defaultImageId_fkey"
FOREIGN KEY ("defaultImageId") REFERENCES "DiningAreaImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
