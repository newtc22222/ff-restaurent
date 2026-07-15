CREATE TYPE "CollectionSystemType" AS ENUM ('FAVORITES', 'RECOMMENDED');

CREATE TABLE "Collection" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "systemType" "CollectionSystemType",
  "ownerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Collection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Collection_ownerId_fkey" FOREIGN KEY ("ownerId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Collection_system_shape_check" CHECK (
    ("systemType" IS NULL AND "ownerId" IS NOT NULL)
    OR ("systemType" = 'FAVORITES' AND "ownerId" IS NOT NULL AND "isPublic" = false)
    OR ("systemType" = 'RECOMMENDED' AND "ownerId" IS NULL AND "isPublic" = true)
  )
);

CREATE TABLE "CollectionShare" (
  "collectionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CollectionShare_pkey" PRIMARY KEY ("collectionId", "userId"),
  CONSTRAINT "CollectionShare_collectionId_fkey" FOREIGN KEY ("collectionId")
    REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CollectionShare_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CollectionRestaurant" (
  "collectionId" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CollectionRestaurant_pkey" PRIMARY KEY ("collectionId", "restaurantId"),
  CONSTRAINT "CollectionRestaurant_collectionId_fkey" FOREIGN KEY ("collectionId")
    REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CollectionRestaurant_restaurantId_fkey" FOREIGN KEY ("restaurantId")
    REFERENCES "RestaurantEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Collection_one_favorites_per_owner_key"
  ON "Collection"("ownerId") WHERE "systemType" = 'FAVORITES';
CREATE UNIQUE INDEX "Collection_one_recommended_key"
  ON "Collection"("systemType") WHERE "systemType" = 'RECOMMENDED';
CREATE INDEX "Collection_ownerId_createdAt_idx" ON "Collection"("ownerId", "createdAt");
CREATE INDEX "Collection_isPublic_createdAt_idx" ON "Collection"("isPublic", "createdAt");
CREATE INDEX "CollectionShare_userId_createdAt_idx" ON "CollectionShare"("userId", "createdAt");
CREATE INDEX "CollectionRestaurant_restaurantId_createdAt_idx" ON "CollectionRestaurant"("restaurantId", "createdAt");
