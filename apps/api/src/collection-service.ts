import { CollectionSystemType, Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

const findFavorites = (userId: string) =>
  prisma.collection.findFirst({
    where: { ownerId: userId, systemType: CollectionSystemType.FAVORITES },
  });

export const ensureFavoritesCollection = async (userId: string) => {
  let collection = await findFavorites(userId);
  if (!collection) {
    try {
      collection = await prisma.collection.create({
        data: {
          name: 'Favorites',
          isPublic: false,
          systemType: CollectionSystemType.FAVORITES,
          ownerId: userId,
        },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
      collection = await findFavorites(userId);
    }
  }
  if (!collection) throw new Error('Favorites collection could not be created');

  const legacy = await prisma.userFavorite.findMany({
    where: { userId },
    select: { restaurantId: true },
  });
  if (legacy.length > 0) {
    await prisma.collectionRestaurant.createMany({
      data: legacy.map(({ restaurantId }) => ({
        collectionId: collection.id,
        restaurantId,
      })),
      skipDuplicates: true,
    });
  }
  return collection;
};

const findRecommended = () =>
  prisma.collection.findFirst({
    where: { systemType: CollectionSystemType.RECOMMENDED },
  });

export const ensureRecommendedCollection = async () => {
  let collection = await findRecommended();
  if (!collection) {
    try {
      collection = await prisma.collection.create({
        data: {
          name: 'Recommended',
          isPublic: true,
          systemType: CollectionSystemType.RECOMMENDED,
        },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
      collection = await findRecommended();
    }
  }
  if (!collection)
    throw new Error('Recommended collection could not be created');

  const legacy = await prisma.restaurantEntry.findMany({
    where: { isRecommended: true },
    select: { id: true },
  });
  if (legacy.length > 0) {
    await prisma.collectionRestaurant.createMany({
      data: legacy.map(({ id: restaurantId }) => ({
        collectionId: collection.id,
        restaurantId,
      })),
      skipDuplicates: true,
    });
  }
  return collection;
};

export const ensureDefaultCollections = async (userId: string) => {
  const [favorites, recommended] = await Promise.all([
    ensureFavoritesCollection(userId),
    ensureRecommendedCollection(),
  ]);
  return { favorites, recommended };
};

export const toggleFavoriteShortcut = async (
  userId: string,
  restaurantId: string,
) => {
  const collection = await ensureFavoritesCollection(userId);
  return prisma.$transaction(async (tx) => {
    await tx.restaurantEntry.findUniqueOrThrow({
      where: { id: restaurantId },
      select: { id: true },
    });
    const [legacy, membership] = await Promise.all([
      tx.userFavorite.findUnique({
        where: { userId_restaurantId: { userId, restaurantId } },
        select: { userId: true },
      }),
      tx.collectionRestaurant.findUnique({
        where: {
          collectionId_restaurantId: {
            collectionId: collection.id,
            restaurantId,
          },
        },
        select: { collectionId: true },
      }),
    ]);
    if (legacy || membership) {
      await Promise.all([
        tx.userFavorite.deleteMany({ where: { userId, restaurantId } }),
        tx.collectionRestaurant.deleteMany({
          where: { collectionId: collection.id, restaurantId },
        }),
      ]);
      return false;
    }
    await Promise.all([
      tx.userFavorite.create({ data: { userId, restaurantId } }),
      tx.collectionRestaurant.create({
        data: { collectionId: collection.id, restaurantId },
      }),
    ]);
    return true;
  });
};

export const toggleRecommendedShortcut = async (restaurantId: string) => {
  const collection = await ensureRecommendedCollection();
  return prisma.$transaction(async (tx) => {
    const restaurant = await tx.restaurantEntry.findUniqueOrThrow({
      where: { id: restaurantId },
      select: { id: true, isRecommended: true },
    });
    const membership = await tx.collectionRestaurant.findUnique({
      where: {
        collectionId_restaurantId: {
          collectionId: collection.id,
          restaurantId,
        },
      },
      select: { collectionId: true },
    });
    const recommended = !(restaurant.isRecommended || membership);
    await tx.restaurantEntry.update({
      where: { id: restaurantId },
      data: { isRecommended: recommended },
    });
    if (recommended) {
      await tx.collectionRestaurant.upsert({
        where: {
          collectionId_restaurantId: {
            collectionId: collection.id,
            restaurantId,
          },
        },
        update: {},
        create: { collectionId: collection.id, restaurantId },
      });
    } else {
      await tx.collectionRestaurant.deleteMany({
        where: { collectionId: collection.id, restaurantId },
      });
    }
    return recommended;
  });
};
