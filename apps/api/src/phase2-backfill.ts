import {
  CollectionSystemType,
  Prisma,
  type PrismaClient,
  RestaurantPlatform,
} from '@prisma/client';
import {
  normalizeCatalogKey,
  normalizeDisplayText,
} from './catalog-normalization.js';

export type BackfillException = {
  kind:
    | 'BANNER_URL_INVALID'
    | 'PLATFORM_URL_INVALID'
    | 'LEGACY_LINK_INVALID'
    | 'CUISINE_NORMALIZED_COLLISION';
  restaurantId?: string;
  field?: string;
  value?: string;
  details?: string[];
};

export type BackfillCounts = {
  users: number;
  restaurants: number;
  legacyFavorites: number;
  legacyRecommended: number;
  legacyGlobalFavorites: number;
  cuisines: number;
  primaryCuisineJoins: number;
  platformLinks: number;
  favoritesCollections: number;
  recommendedCollections: number;
  collectionMemberships: number;
};

export type Phase2BackfillReport = {
  startedAt: string;
  completedAt: string;
  dryRun: boolean;
  pre: BackfillCounts;
  post: BackfillCounts;
  actions: {
    restaurantBatches: number;
    usersProcessed: number;
    cuisinesCreated: number;
    primaryCuisineJoinsCreated: number;
    bannersPromoted: number;
    platformLinksCreated: number;
    favoritesCollectionsCreated: number;
    recommendedCollectionsCreated: number;
    favoriteMembershipsCreated: number;
    recommendedMembershipsCreated: number;
  };
  exceptions: BackfillException[];
  verification: {
    restaurantsWithoutPrimaryCuisine: number;
    usersWithoutFavorites: number;
    duplicateFavoritesOwners: number;
    recommendedCollections: number;
    passed: boolean;
  };
};

type LegacyLinkCandidate = { label: string; url: string };

const isHttpsUrl = (value: string) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

export const planLegacyLinks = (
  restaurantId: string,
  value: Prisma.JsonValue,
) => {
  const candidates: LegacyLinkCandidate[] = [];
  const exceptions: BackfillException[] = [];
  if (!Array.isArray(value)) {
    if (value !== null) {
      exceptions.push({
        kind: 'LEGACY_LINK_INVALID',
        restaurantId,
        field: 'links',
        value: 'non-array JSON',
      });
    }
    return { candidates, exceptions };
  }
  value.forEach((item, index) => {
    if (!item || Array.isArray(item) || typeof item !== 'object') {
      exceptions.push({
        kind: 'LEGACY_LINK_INVALID',
        restaurantId,
        field: `links.${index}`,
        value: 'non-object entry',
      });
      return;
    }
    const record = item as Record<string, Prisma.JsonValue>;
    const url = typeof record.url === 'string' ? record.url.trim() : '';
    if (!isHttpsUrl(url)) {
      exceptions.push({
        kind: 'LEGACY_LINK_INVALID',
        restaurantId,
        field: `links.${index}.url`,
        value: url || '(blank)',
      });
      return;
    }
    candidates.push({
      label:
        typeof record.label === 'string' && record.label.trim()
          ? record.label.trim().slice(0, 60)
          : 'Legacy link',
      url,
    });
  });
  return { candidates, exceptions };
};

export const findCuisineCollisions = (
  restaurants: Array<{ id: string; cuisineType: string }>,
) => {
  const groups = new Map<
    string,
    { values: Set<string>; restaurantIds: string[] }
  >();
  for (const restaurant of restaurants) {
    const display = normalizeDisplayText(
      restaurant.cuisineType || 'Uncategorized',
    );
    const key = normalizeCatalogKey(display);
    const group = groups.get(key) ?? { values: new Set(), restaurantIds: [] };
    group.values.add(restaurant.cuisineType);
    group.restaurantIds.push(restaurant.id);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.values.size > 1)
    .map(([key, group]): BackfillException => ({
      kind: 'CUISINE_NORMALIZED_COLLISION',
      field: key,
      details: [...group.values].sort(),
      value: group.restaurantIds.sort().join(','),
    }));
};

const getCounts = async (client: PrismaClient): Promise<BackfillCounts> => {
  const [
    users,
    restaurants,
    legacyFavorites,
    legacyRecommended,
    legacyGlobalFavorites,
    cuisines,
    primaryCuisineJoins,
    platformLinks,
    favoritesCollections,
    recommendedCollections,
    collectionMemberships,
  ] = await Promise.all([
    client.user.count(),
    client.restaurantEntry.count(),
    client.userFavorite.count(),
    client.restaurantEntry.count({ where: { isRecommended: true } }),
    client.restaurantEntry.count({ where: { isFavorite: true } }),
    client.cuisine.count(),
    client.restaurantCuisine.count({ where: { isPrimary: true } }),
    client.restaurantPlatformLink.count(),
    client.collection.count({
      where: { systemType: CollectionSystemType.FAVORITES },
    }),
    client.collection.count({
      where: { systemType: CollectionSystemType.RECOMMENDED },
    }),
    client.collectionRestaurant.count(),
  ]);
  return {
    users,
    restaurants,
    legacyFavorites,
    legacyRecommended,
    legacyGlobalFavorites,
    cuisines,
    primaryCuisineJoins,
    platformLinks,
    favoritesCollections,
    recommendedCollections,
    collectionMemberships,
  };
};

const createFavorites = async (client: PrismaClient, userId: string) => {
  const existing = await client.collection.findFirst({
    where: { ownerId: userId, systemType: CollectionSystemType.FAVORITES },
  });
  if (existing) return { collection: existing, created: false };
  try {
    return {
      collection: await client.collection.create({
        data: {
          name: 'Favorites',
          ownerId: userId,
          systemType: CollectionSystemType.FAVORITES,
        },
      }),
      created: true,
    };
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      throw error;
    }
    return {
      collection: await client.collection.findFirstOrThrow({
        where: { ownerId: userId, systemType: CollectionSystemType.FAVORITES },
      }),
      created: false,
    };
  }
};

const createRecommended = async (client: PrismaClient) => {
  const existing = await client.collection.findFirst({
    where: { systemType: CollectionSystemType.RECOMMENDED },
  });
  if (existing) return { collection: existing, created: false };
  try {
    return {
      collection: await client.collection.create({
        data: {
          name: 'Recommended',
          isPublic: true,
          systemType: CollectionSystemType.RECOMMENDED,
        },
      }),
      created: true,
    };
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      throw error;
    }
    return {
      collection: await client.collection.findFirstOrThrow({
        where: { systemType: CollectionSystemType.RECOMMENDED },
      }),
      created: false,
    };
  }
};

export const runPhase2Backfill = async ({
  client,
  dryRun = false,
  batchSize = 100,
  log = () => undefined,
}: {
  client: PrismaClient;
  dryRun?: boolean;
  batchSize?: number;
  log?: (event: Record<string, unknown>) => void;
}): Promise<Phase2BackfillReport> => {
  const startedAt = new Date().toISOString();
  const pre = await getCounts(client);
  const actions = {
    restaurantBatches: 0,
    usersProcessed: 0,
    cuisinesCreated: 0,
    primaryCuisineJoinsCreated: 0,
    bannersPromoted: 0,
    platformLinksCreated: 0,
    favoritesCollectionsCreated: 0,
    recommendedCollectionsCreated: 0,
    favoriteMembershipsCreated: 0,
    recommendedMembershipsCreated: 0,
  };
  const exceptions: BackfillException[] = [];
  const collisionSource = await client.restaurantEntry.findMany({
    select: { id: true, cuisineType: true },
  });
  exceptions.push(...findCuisineCollisions(collisionSource));

  let cursor: string | undefined;
  while (true) {
    const restaurants = await client.restaurantEntry.findMany({
      orderBy: { id: 'asc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: batchSize,
      select: {
        id: true,
        cuisineType: true,
        avatarUrl: true,
        bannerImageUrl: true,
        links: true,
        platformLinks: { select: { id: true, url: true, sortOrder: true } },
        cuisines: { select: { cuisineId: true, isPrimary: true } },
      },
    });
    if (restaurants.length === 0) break;
    actions.restaurantBatches += 1;

    for (const restaurant of restaurants) {
      const display = normalizeDisplayText(
        restaurant.cuisineType || 'Uncategorized',
      );
      const key = normalizeCatalogKey(display);
      let cuisine = await client.cuisine.findUnique({
        where: { nameKey: key },
      });
      if (!cuisine && !dryRun) {
        cuisine = await client.cuisine.create({
          data: { name: display, nameKey: key, type: 'Legacy' },
        });
        actions.cuisinesCreated += 1;
      }
      if (!restaurant.cuisines.some((item) => item.isPrimary) && cuisine) {
        if (!dryRun) {
          await client.$transaction(async (tx) => {
            await tx.restaurantCuisine.updateMany({
              where: { restaurantId: restaurant.id },
              data: { isPrimary: false },
            });
            await tx.restaurantCuisine.upsert({
              where: {
                restaurantId_cuisineId: {
                  restaurantId: restaurant.id,
                  cuisineId: cuisine.id,
                },
              },
              update: { isPrimary: true },
              create: {
                restaurantId: restaurant.id,
                cuisineId: cuisine.id,
                isPrimary: true,
              },
            });
          });
        }
        actions.primaryCuisineJoinsCreated += 1;
      }

      const bannerCandidate = restaurant.bannerImageUrl ?? restaurant.avatarUrl;
      if (bannerCandidate && !isHttpsUrl(bannerCandidate)) {
        exceptions.push({
          kind: 'BANNER_URL_INVALID',
          restaurantId: restaurant.id,
          field: restaurant.bannerImageUrl ? 'bannerImageUrl' : 'avatarUrl',
          value: bannerCandidate,
        });
      } else if (
        !restaurant.bannerImageUrl &&
        restaurant.avatarUrl &&
        bannerCandidate &&
        !dryRun
      ) {
        await client.restaurantEntry.update({
          where: { id: restaurant.id },
          data: { bannerImageUrl: bannerCandidate },
        });
        actions.bannersPromoted += 1;
      }

      for (const link of restaurant.platformLinks) {
        if (!isHttpsUrl(link.url)) {
          exceptions.push({
            kind: 'PLATFORM_URL_INVALID',
            restaurantId: restaurant.id,
            field: `platformLinks.${link.id}`,
            value: link.url,
          });
        }
      }
      const legacyLinks = planLegacyLinks(restaurant.id, restaurant.links);
      exceptions.push(...legacyLinks.exceptions);
      let nextSortOrder =
        Math.max(
          -1,
          ...restaurant.platformLinks.map((link) => link.sortOrder),
        ) + 1;
      for (const candidate of legacyLinks.candidates) {
        const existing = await client.restaurantPlatformLink.findFirst({
          where: {
            restaurantId: restaurant.id,
            url: { equals: candidate.url, mode: 'insensitive' },
          },
          select: { id: true },
        });
        if (!existing && !dryRun) {
          await client.restaurantPlatformLink.create({
            data: {
              restaurantId: restaurant.id,
              platform: RestaurantPlatform.OTHER,
              label: candidate.label,
              url: candidate.url,
              sortOrder: nextSortOrder++,
            },
          });
          actions.platformLinksCreated += 1;
        }
      }
    }
    cursor = restaurants.at(-1)?.id;
    log({
      event: 'phase2_backfill_restaurant_batch',
      batch: actions.restaurantBatches,
      processed: restaurants.length,
      cursor,
    });
  }

  const users = await client.user.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, favorites: { select: { restaurantId: true } } },
  });
  if (!dryRun) {
    for (const user of users) {
      const favorite = await createFavorites(client, user.id);
      if (favorite.created) actions.favoritesCollectionsCreated += 1;
      const inserted = await client.collectionRestaurant.createMany({
        data: user.favorites.map(({ restaurantId }) => ({
          collectionId: favorite.collection.id,
          restaurantId,
        })),
        skipDuplicates: true,
      });
      actions.favoriteMembershipsCreated += inserted.count;
      actions.usersProcessed += 1;
    }
    const recommended = await createRecommended(client);
    if (recommended.created) actions.recommendedCollectionsCreated += 1;
    const recommendedRestaurants = await client.restaurantEntry.findMany({
      where: { OR: [{ isRecommended: true }, { isFavorite: true }] },
      select: { id: true },
    });
    const inserted = await client.collectionRestaurant.createMany({
      data: recommendedRestaurants.map(({ id: restaurantId }) => ({
        collectionId: recommended.collection.id,
        restaurantId,
      })),
      skipDuplicates: true,
    });
    actions.recommendedMembershipsCreated += inserted.count;
  } else {
    actions.usersProcessed = users.length;
  }

  const post = await getCounts(client);
  const [
    restaurantsWithoutPrimaryCuisine,
    usersWithoutFavorites,
    favoritesGroups,
  ] = await Promise.all([
    client.restaurantEntry.count({
      where: { cuisines: { none: { isPrimary: true } } },
    }),
    client.user.count({
      where: {
        ownedCollections: {
          none: { systemType: CollectionSystemType.FAVORITES },
        },
      },
    }),
    client.collection.groupBy({
      by: ['ownerId'],
      where: { systemType: CollectionSystemType.FAVORITES },
      _count: { _all: true },
    }),
  ]);
  const duplicateFavoritesOwners = favoritesGroups.filter(
    (group) => group._count._all !== 1,
  ).length;
  const verification = {
    restaurantsWithoutPrimaryCuisine,
    usersWithoutFavorites,
    duplicateFavoritesOwners,
    recommendedCollections: post.recommendedCollections,
    passed:
      !dryRun &&
      restaurantsWithoutPrimaryCuisine === 0 &&
      usersWithoutFavorites === 0 &&
      duplicateFavoritesOwners === 0 &&
      post.recommendedCollections === 1,
  };
  const report = {
    startedAt,
    completedAt: new Date().toISOString(),
    dryRun,
    pre,
    post,
    actions,
    exceptions,
    verification,
  } satisfies Phase2BackfillReport;
  log({ event: 'phase2_backfill_complete', ...report });
  return report;
};
