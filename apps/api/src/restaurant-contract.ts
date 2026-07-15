import { Prisma } from '@prisma/client';

/** Public restaurant contract intentionally excludes the legacy `links` JSON. */
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
  cuisineType: true,
  type: true,
  avatarUrl: true,
  isRecommended: true,
  isFavorite: true,
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
} satisfies Prisma.RestaurantEntrySelect;
