import { Prisma } from '@prisma/client';

/**
 * Public restaurant query shape. Legacy response fields are derived during
 * serialization.
 *
 * The `collections` relation is scoped to only the memberships serialization
 * needs: the global RECOMMENDED membership and, when a viewer is known, that
 * viewer's own FAVORITES membership. Without the per-user filter a restaurant
 * favorited by many users would load every user's FAVORITES membership on each
 * list item and every bill response, multiplying rows and memory by the total
 * favorite count. The filter bounds it to at most two rows per restaurant.
 */
export const buildPublicRestaurantSelect = (userId?: string) =>
  ({
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
      where: {
        collection: {
          OR: [
            { systemType: 'RECOMMENDED' as const },
            ...(userId
              ? [{ systemType: 'FAVORITES' as const, ownerId: userId }]
              : []),
          ],
        },
      },
      select: {
        collection: {
          select: { systemType: true, ownerId: true },
        },
      },
    },
  }) satisfies Prisma.RestaurantEntrySelect;

export type PublicRestaurantRecord = Prisma.RestaurantEntryGetPayload<{
  select: ReturnType<typeof buildPublicRestaurantSelect>;
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
