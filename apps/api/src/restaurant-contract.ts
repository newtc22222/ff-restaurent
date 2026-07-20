import { Prisma } from '@prisma/client';

/** Public restaurant query shape. Legacy fields are derived during serialization. */
export const publicRestaurantSelect = {
  id: true,
  name: true,
  address: true,
  addressLine: true,
  provinceCode: true,
  provinceName: true,
  wardCode: true,
  wardName: true,
  phone: true,
  bannerImageUrl: true,
  diningAreaId: true,
  diningArea: {
    select: {
      id: true,
      name: true,
      address: true,
      addressLine: true,
      provinceCode: true,
      provinceName: true,
      wardCode: true,
      wardName: true,
      description: true,
    },
  },
  type: true,
  avatarUrl: true,
  status: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  platformLinks: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      platform: true,
      label: true,
      url: true,
      sortOrder: true,
    },
  },
  cuisines: {
    orderBy: [
      { isPrimary: 'desc' as const },
      { cuisine: { nameKey: 'asc' as const } },
    ],
    select: {
      isPrimary: true,
      cuisine: {
        select: {
          id: true,
          name: true,
          type: true,
          description: true,
        },
      },
    },
  },
  collections: {
    where: { collection: { systemType: { not: null } } },
    select: {
      collection: {
        select: { systemType: true, ownerId: true },
      },
    },
  },
} satisfies Prisma.RestaurantEntrySelect;

export type PublicRestaurantRecord = Prisma.RestaurantEntryGetPayload<{
  select: typeof publicRestaurantSelect;
}>;

export const serializePublicRestaurant = (
  restaurant: PublicRestaurantRecord,
  userId?: string,
) => {
  const { collections, ...publicFields } = restaurant;
  const isRecommended = collections.some(
    ({ collection }) => collection.systemType === 'RECOMMENDED',
  );
  const isFavoritedByMe = Boolean(
    userId &&
    collections.some(
      ({ collection }) =>
        collection.systemType === 'FAVORITES' && collection.ownerId === userId,
    ),
  );
  return {
    ...publicFields,
    cuisineType:
      restaurant.cuisines.find(({ isPrimary }) => isPrimary)?.cuisine.name ??
      'Uncategorized',
    isRecommended,
    isFavoritedByMe,
    isFavorite: isFavoritedByMe,
  };
};
