import { Prisma } from '@prisma/client';
import type { z } from 'zod';

import { conflict } from '../http/app-error.js';
import {
  diningAreaKey,
  normalizeCatalogKey,
  normalizeDisplayText,
} from '../lib/catalog-normalization.js';
import { pageResult } from '../lib/pagination.js';
import { prisma } from '../lib/prisma.js';
import { normalizeSearchQuery } from '../lib/search-normalization.js';
import type {
  catalogQuerySchema,
  cuisineSchema,
  diningAreaSchema,
  diningAreaUpdateSchema,
} from '../schemas/index.js';

/**
 * Cuisine and Dining Area catalogs.
 *
 * Both are reference data referenced by restaurants, so deletes are guarded by
 * a reference count rather than cascading — removing a cuisine that
 * restaurants still use would silently break the Phase 2 invariant that every
 * restaurant has exactly one primary cuisine.
 */

const cuisineSelect = {
  id: true,
  name: true,
  type: true,
  description: true,
} satisfies Prisma.CuisineSelect;

const diningAreaSelect = {
  id: true,
  name: true,
  address: true,
  addressLine: true,
  provinceCode: true,
  provinceName: true,
  wardCode: true,
  wardName: true,
  description: true,
} satisfies Prisma.DiningAreaSelect;

type CatalogQuery = z.infer<typeof catalogQuerySchema>;
type CuisineInput = z.infer<typeof cuisineSchema>;
type DiningAreaInput = z.infer<typeof diningAreaSchema>;
type DiningAreaUpdate = z.infer<typeof diningAreaUpdateSchema>;

export const listCuisines = async (query: CatalogQuery) => {
  const orderBy: Prisma.CuisineOrderByWithRelationInput[] =
    query.sort === 'name-desc'
      ? [{ nameKey: 'desc' }, { id: 'desc' }]
      : query.sort === 'created-desc'
        ? [{ createdAt: 'desc' }, { id: 'desc' }]
        : query.sort === 'created-asc'
          ? [{ createdAt: 'asc' }, { id: 'asc' }]
          : [{ nameKey: 'asc' }, { id: 'asc' }];
  const items = await prisma.cuisine.findMany({
    where: {
      searchText: query.search
        ? { contains: normalizeSearchQuery(query.search) }
        : undefined,
      type: query.type
        ? { equals: query.type, mode: 'insensitive' }
        : undefined,
    },
    orderBy,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    take: query.limit + 1,
    select: cuisineSelect,
  });
  return pageResult(items, query.limit);
};

export const createCuisine = (body: CuisineInput) =>
  prisma.cuisine.create({
    data: {
      name: normalizeDisplayText(body.name),
      nameKey: normalizeCatalogKey(body.name),
      type: normalizeDisplayText(body.type),
      description: body.description || null,
    },
    select: cuisineSelect,
  });

export const updateCuisine = (id: string, body: Partial<CuisineInput>) =>
  prisma.cuisine.update({
    where: { id },
    data: {
      ...(body.name
        ? {
            name: normalizeDisplayText(body.name),
            nameKey: normalizeCatalogKey(body.name),
          }
        : {}),
      ...(body.type ? { type: normalizeDisplayText(body.type) } : {}),
      ...(body.description !== undefined
        ? { description: body.description || null }
        : {}),
    },
    select: cuisineSelect,
  });

export const deleteCuisine = async (id: string) => {
  const references = await prisma.restaurantCuisine.count({
    where: { cuisineId: id },
  });
  if (references > 0) {
    throw conflict(
      'CUISINE_IN_USE',
      'Cuisine cannot be deleted while restaurants reference it',
    );
  }
  await prisma.cuisine.delete({ where: { id } });
};

export const listDiningAreas = async (query: CatalogQuery) => {
  const orderBy: Prisma.DiningAreaOrderByWithRelationInput[] =
    query.sort === 'name-desc'
      ? [{ normalizedKey: 'desc' }, { id: 'desc' }]
      : query.sort === 'created-desc'
        ? [{ createdAt: 'desc' }, { id: 'desc' }]
        : query.sort === 'created-asc'
          ? [{ createdAt: 'asc' }, { id: 'asc' }]
          : [{ normalizedKey: 'asc' }, { id: 'asc' }];
  const items = await prisma.diningArea.findMany({
    where: {
      searchText: query.search
        ? { contains: normalizeSearchQuery(query.search) }
        : undefined,
      provinceCode: query.provinceCode,
    },
    orderBy,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    take: query.limit + 1,
    select: diningAreaSelect,
  });
  return pageResult(items, query.limit);
};

export const createDiningArea = (body: DiningAreaInput) => {
  const name = normalizeDisplayText(body.name);
  return prisma.diningArea.create({
    data: {
      ...body,
      name,
      description: body.description || null,
      normalizedKey: diningAreaKey(name, body.address),
    },
    select: diningAreaSelect,
  });
};

/**
 * The normalized key is rebuilt from the *resulting* name and address, so a
 * partial update that changes only one of them still produces a correct key.
 */
export const updateDiningArea = async (id: string, body: DiningAreaUpdate) => {
  const existing = await prisma.diningArea.findUniqueOrThrow({ where: { id } });
  const name = normalizeDisplayText(body.name ?? existing.name);
  const address = body.address ?? existing.address;
  return prisma.diningArea.update({
    where: { id },
    data: {
      ...body,
      name,
      normalizedKey: diningAreaKey(name, address),
      ...(body.description !== undefined
        ? { description: body.description || null }
        : {}),
    },
    select: diningAreaSelect,
  });
};

export const deleteDiningArea = async (id: string) => {
  const references = await prisma.restaurantEntry.count({
    where: { diningAreaId: id },
  });
  if (references > 0) {
    throw conflict(
      'DINING_AREA_IN_USE',
      'Dining Area cannot be deleted while restaurants reference it',
    );
  }
  await prisma.diningArea.delete({ where: { id } });
};
