import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import {
  ChefRole,
  CollectionSystemType,
  PaymentStatus,
  Prisma,
  SystemRole,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { prisma } from './prisma.js';
import {
  RootAdminTransferError,
  transferRootAdmin,
} from './root-admin-service.js';

const integrationTest =
  process.env.RUN_INTEGRATION_TESTS === '1' ? test : test.skip;

let app: FastifyInstance;
let headId: string;
let rootId: string;
let sousId: string;
let customerAId: string;
let customerBId: string;
let restaurantId: string;
let billId: string;

const tokenFor = (id: string, expiresIn = '8h', version?: number) =>
  app.jwt.sign(
    { sub: id, ...(version === undefined ? {} : { ver: version }) },
    { expiresIn },
  );
const auth = (token: string) => ({ authorization: `Bearer ${token}` });

before(async () => {
  if (process.env.RUN_INTEGRATION_TESTS !== '1') return;
  process.env.JWT_SECRET ??=
    'integration-secret-that-is-at-least-32-characters';
  process.env.REGISTRATION_INVITE_CODE ??= 'integration-invite';
  app = await buildApp();
  await prisma.passwordResetRequest.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.billAuditLog.deleteMany();
  await prisma.rootAdminTransferAudit.deleteMany();
  await prisma.roleAuditLog.deleteMany();
  await prisma.billParticipant.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.collection.deleteMany();
  await prisma.userFavorite.deleteMany();
  await prisma.restaurantEntry.deleteMany();
  await prisma.cuisine.deleteMany();
  await prisma.diningArea.deleteMany();
  await prisma.user.deleteMany();
  const passwordHash = await bcrypt.hash('password123', 4);
  const [root, head, sous, customerA, customerB] = await Promise.all([
    prisma.user.create({
      data: {
        username: 'root-int',
        name: 'Root Admin',
        passwordHash,
        systemRole: SystemRole.ROOT_ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        username: 'head-int',
        name: 'Head',
        passwordHash,
        chefRole: ChefRole.HEAD_CHEF,
      },
    }),
    prisma.user.create({
      data: {
        username: 'sous-int',
        name: 'Sous',
        passwordHash,
        chefRole: ChefRole.SOUS_CHEF,
      },
    }),
    prisma.user.create({
      data: { username: 'customer-a-int', name: 'Customer A', passwordHash },
    }),
    prisma.user.create({
      data: { username: 'customer-b-int', name: 'Customer B', passwordHash },
    }),
  ]);
  rootId = root.id;
  headId = head.id;
  sousId = sous.id;
  customerAId = customerA.id;
  customerBId = customerB.id;
  restaurantId = (
    await prisma.restaurantEntry.create({
      data: {
        name: 'Integration Restaurant',
        address: '1 Test Street',
        cuisineType: 'Test',
        type: 'Restaurant',
        createdById: sousId,
      },
    })
  ).id;
});

after(async () => {
  if (process.env.RUN_INTEGRATION_TESTS !== '1') return;
  await app.close();
  await prisma.$disconnect();
});

integrationTest(
  'onboarding is invite-gated and tokens are enforced',
  async () => {
    const denied = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name: 'Denied',
        username: 'denied-user',
        password: 'password123',
        inviteCode: 'wrong-code',
      },
    });
    assert.equal(denied.statusCode, 403);
    assert.equal(denied.json().code, 'REGISTRATION_NOT_AUTHORIZED');

    const allowed = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name: 'Invited',
        username: 'invited-user',
        password: 'password123',
        inviteCode: process.env.REGISTRATION_INVITE_CODE,
      },
    });
    assert.equal(allowed.statusCode, 201);
    assert.equal('passwordHash' in allowed.json().user, false);

    const invalid = await app.inject({
      method: 'GET',
      url: '/me',
      headers: auth('invalid-token'),
    });
    assert.equal(invalid.statusCode, 401);

    const expired = await app.inject({
      method: 'GET',
      url: '/me',
      headers: auth(tokenFor(customerAId, '-1s')),
    });
    assert.equal(expired.statusCode, 401);
  },
);

integrationTest(
  'Vietnamese phone normalization, login precedence, duplicates, and clearing work',
  async () => {
    const register = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name: 'Phone Member',
        username: 'phone-member-int',
        phone: '0901 234 567',
        password: 'phone-password',
        inviteCode: process.env.REGISTRATION_INVITE_CODE,
      },
    });
    assert.equal(register.statusCode, 201);
    assert.equal(register.json().user.phone, '+84901234567');

    const phoneLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { identifier: '0901234567', password: 'phone-password' },
    });
    assert.equal(phoneLogin.statusCode, 200);
    assert.equal(phoneLogin.json().user.username, 'phone-member-int');

    await prisma.user.create({
      data: {
        name: 'Phone-looking Username',
        username: '0901234567',
        passwordHash: await bcrypt.hash('username-password', 4),
      },
    });
    const usernameLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { identifier: '0901234567', password: 'username-password' },
    });
    assert.equal(usernameLogin.statusCode, 200);
    assert.equal(usernameLogin.json().user.username, '0901234567');

    const duplicate = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name: 'Duplicate Phone',
        username: 'duplicate-phone-int',
        phone: '+84901234567',
        password: 'password123',
        inviteCode: process.env.REGISTRATION_INVITE_CODE,
      },
    });
    assert.equal(duplicate.statusCode, 409);
    assert.equal(duplicate.json().code, 'IDENTIFIER_TAKEN');

    const invalid = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name: 'Invalid Phone',
        username: 'invalid-phone-int',
        phone: '+12025550123',
        password: 'password123',
        inviteCode: process.env.REGISTRATION_INVITE_CODE,
      },
    });
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.json().code, 'VALIDATION_ERROR');

    const clear = await app.inject({
      method: 'PUT',
      url: '/me/profile',
      headers: auth(register.json().token),
      payload: { phone: '' },
    });
    assert.equal(clear.statusCode, 200);
    assert.equal(clear.json().phone, null);
  },
);

integrationTest('ROOT_ADMIN exclusively governs chef roles', async () => {
  const denied = await app.inject({
    method: 'GET',
    url: '/users',
    headers: auth(tokenFor(customerAId)),
  });
  assert.equal(denied.statusCode, 403);

  const headList = await app.inject({
    method: 'GET',
    url: '/users',
    headers: auth(tokenFor(headId)),
  });
  assert.equal(headList.statusCode, 403);
  assert.equal(headList.json().code, 'ROOT_ADMIN_REQUIRED');

  for (const targetId of [customerAId, sousId, headId, rootId]) {
    const headChange = await app.inject({
      method: 'PATCH',
      url: `/users/${targetId}/chef-role`,
      headers: auth(tokenFor(headId)),
      payload: { chefRole: ChefRole.SOUS_CHEF },
    });
    assert.equal(headChange.statusCode, 403);
    assert.equal(headChange.json().code, 'ROOT_ADMIN_REQUIRED');
  }

  const rootList = await app.inject({
    method: 'GET',
    url: '/users',
    headers: auth(tokenFor(rootId)),
  });
  assert.equal(rootList.statusCode, 200);
  assert.equal(JSON.stringify(rootList.json()).includes('passwordHash'), false);
  assert.equal(
    JSON.stringify(rootList.json()).includes('sessionVersion'),
    false,
  );

  const rootTarget = await app.inject({
    method: 'PATCH',
    url: `/users/${rootId}/chef-role`,
    headers: auth(tokenFor(rootId)),
    payload: { chefRole: ChefRole.HEAD_CHEF },
  });
  assert.equal(rootTarget.statusCode, 403);
  assert.equal(rootTarget.json().code, 'ROOT_ADMIN_ROLE_CHANGE_FORBIDDEN');

  const promoted = await app.inject({
    method: 'PATCH',
    url: `/users/${customerAId}/chef-role`,
    headers: auth(tokenFor(rootId)),
    payload: { chefRole: ChefRole.SOUS_CHEF },
  });
  assert.equal(promoted.statusCode, 200);
  assert.equal(promoted.json().chefRole, ChefRole.SOUS_CHEF);
  const restored = await app.inject({
    method: 'PATCH',
    url: `/users/${customerAId}/chef-role`,
    headers: auth(tokenFor(rootId)),
    payload: { chefRole: null },
  });
  assert.equal(restored.statusCode, 200);
});

integrationTest('the database permits exactly one ROOT_ADMIN', async () => {
  await assert.rejects(
    prisma.user.create({
      data: {
        username: 'second-root-int',
        name: 'Second Root',
        passwordHash: await bcrypt.hash('password123', 4),
        systemRole: SystemRole.ROOT_ADMIN,
      },
    }),
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002',
  );
  assert.equal(
    await prisma.user.count({
      where: { systemRole: SystemRole.ROOT_ADMIN },
    }),
    1,
  );
});

integrationTest(
  'Collections enforce visibility, ownership, system invariants, pagination, and shortcut compatibility',
  async () => {
    const defaults = await app.inject({
      method: 'GET',
      url: '/collections',
      headers: auth(tokenFor(customerAId)),
    });
    assert.equal(defaults.statusCode, 200);
    const favorites = defaults
      .json()
      .items.find(
        (collection: { systemType: CollectionSystemType | null }) =>
          collection.systemType === CollectionSystemType.FAVORITES,
      );
    const recommended = defaults
      .json()
      .items.find(
        (collection: { systemType: CollectionSystemType | null }) =>
          collection.systemType === CollectionSystemType.RECOMMENDED,
      );
    assert.ok(favorites);
    assert.ok(recommended);
    assert.equal(favorites.isPublic, false);
    assert.equal(recommended.isPublic, true);

    const created = await app.inject({
      method: 'POST',
      url: '/collections',
      headers: auth(tokenFor(customerAId)),
      payload: {
        name: 'Team lunches',
        description: 'Places to try together',
        isPublic: false,
      },
    });
    assert.equal(created.statusCode, 201);
    const collectionId = created.json().id as string;

    const hidden = await app.inject({
      method: 'GET',
      url: `/collections/${collectionId}`,
      headers: auth(tokenFor(customerBId)),
    });
    assert.equal(hidden.statusCode, 404);

    const shared = await app.inject({
      method: 'POST',
      url: `/collections/${collectionId}/shares`,
      headers: auth(tokenFor(customerAId)),
      payload: { userId: customerBId },
    });
    assert.equal(shared.statusCode, 201);
    assert.equal(
      (
        await app.inject({
          method: 'GET',
          url: `/collections/${collectionId}`,
          headers: auth(tokenFor(customerBId)),
        })
      ).statusCode,
      200,
    );

    const sharedMutation = await app.inject({
      method: 'POST',
      url: `/collections/${collectionId}/restaurants/${restaurantId}`,
      headers: auth(tokenFor(customerBId)),
    });
    assert.equal(sharedMutation.statusCode, 403);

    const addRestaurant = await app.inject({
      method: 'POST',
      url: `/collections/${collectionId}/restaurants/${restaurantId}`,
      headers: auth(tokenFor(customerAId)),
    });
    assert.equal(addRestaurant.statusCode, 201);
    const restaurants = await app.inject({
      method: 'GET',
      url: `/collections/${collectionId}/restaurants?limit=1&search=Integration`,
      headers: auth(tokenFor(customerBId)),
    });
    assert.equal(restaurants.statusCode, 200);
    assert.equal(restaurants.json().items[0].id, restaurantId);
    assert.deepEqual(Object.keys(restaurants.json().pageInfo).sort(), [
      'endCursor',
      'hasNextPage',
    ]);

    const removeShare = await app.inject({
      method: 'DELETE',
      url: `/collections/${collectionId}/shares/${customerBId}`,
      headers: auth(tokenFor(customerAId)),
    });
    assert.equal(removeShare.statusCode, 204);
    assert.equal(
      (
        await app.inject({
          method: 'GET',
          url: `/collections/${collectionId}`,
          headers: auth(tokenFor(customerBId)),
        })
      ).statusCode,
      404,
    );

    const madePublic = await app.inject({
      method: 'PUT',
      url: `/collections/${collectionId}`,
      headers: auth(tokenFor(customerAId)),
      payload: { isPublic: true },
    });
    assert.equal(madePublic.statusCode, 200);
    const secondPublic = await app.inject({
      method: 'POST',
      url: '/collections',
      headers: auth(tokenFor(customerAId)),
      payload: { name: 'Team dinners', isPublic: true },
    });
    assert.equal(secondPublic.statusCode, 201);
    const publicSearch = await app.inject({
      method: 'GET',
      url: '/collections?search=team&limit=1',
      headers: auth(tokenFor(customerBId)),
    });
    assert.equal(publicSearch.statusCode, 200);
    assert.equal(publicSearch.json().items.length, 1);
    assert.equal(publicSearch.json().pageInfo.hasNextPage, true);
    assert.ok(publicSearch.json().pageInfo.endCursor);
    const nextPage = await app.inject({
      method: 'GET',
      url: `/collections?search=team&limit=1&cursor=${publicSearch.json().pageInfo.endCursor}`,
      headers: auth(tokenFor(customerBId)),
    });
    assert.equal(nextPage.statusCode, 200);
    assert.equal(nextPage.json().items.length, 1);
    assert.notEqual(
      nextPage.json().items[0].id,
      publicSearch.json().items[0].id,
    );

    const immutable = await app.inject({
      method: 'PUT',
      url: `/collections/${favorites.id}`,
      headers: auth(tokenFor(customerAId)),
      payload: { name: 'Renamed' },
    });
    assert.equal(immutable.statusCode, 409);
    assert.equal(immutable.json().code, 'SYSTEM_COLLECTION_IMMUTABLE');

    const deniedRecommendation = await app.inject({
      method: 'POST',
      url: `/collections/${recommended.id}/restaurants/${restaurantId}`,
      headers: auth(tokenFor(customerAId)),
    });
    assert.equal(deniedRecommendation.statusCode, 403);
    const chefRecommendation = await app.inject({
      method: 'POST',
      url: `/collections/${recommended.id}/restaurants/${restaurantId}`,
      headers: auth(tokenFor(sousId)),
    });
    assert.equal(chefRecommendation.statusCode, 201);
    assert.equal(
      (
        await prisma.restaurantEntry.findUniqueOrThrow({
          where: { id: restaurantId },
        })
      ).isRecommended,
      true,
    );
    const recommendationShortcutOff = await app.inject({
      method: 'PATCH',
      url: `/restaurants/${restaurantId}/recommend`,
      headers: auth(tokenFor(sousId)),
    });
    assert.equal(recommendationShortcutOff.statusCode, 200);
    assert.equal(recommendationShortcutOff.json().isRecommended, false);
    assert.equal(
      await prisma.collectionRestaurant.count({
        where: { collectionId: recommended.id, restaurantId },
      }),
      0,
    );
    const recommendationShortcutOn = await app.inject({
      method: 'PATCH',
      url: `/restaurants/${restaurantId}/recommend`,
      headers: auth(tokenFor(sousId)),
    });
    assert.equal(recommendationShortcutOn.statusCode, 200);
    assert.equal(recommendationShortcutOn.json().isRecommended, true);

    const favoriteShortcut = await app.inject({
      method: 'POST',
      url: `/restaurants/${restaurantId}/favorite`,
      headers: auth(tokenFor(customerAId)),
    });
    assert.equal(favoriteShortcut.statusCode, 200);
    assert.equal(favoriteShortcut.json().favorited, true);
    assert.ok(
      await prisma.collectionRestaurant.findUnique({
        where: {
          collectionId_restaurantId: {
            collectionId: favorites.id,
            restaurantId,
          },
        },
      }),
    );
    assert.ok(
      await prisma.userFavorite.findUnique({
        where: { userId_restaurantId: { userId: customerAId, restaurantId } },
      }),
    );

    await assert.rejects(
      prisma.collection.create({
        data: {
          name: 'Duplicate Favorites',
          ownerId: customerAId,
          systemType: CollectionSystemType.FAVORITES,
        },
      }),
      (error: unknown) =>
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002',
    );
    await assert.rejects(
      prisma.collection.create({
        data: {
          name: 'Duplicate Recommended',
          isPublic: true,
          systemType: CollectionSystemType.RECOMMENDED,
        },
      }),
      (error: unknown) =>
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002',
    );
  },
);

integrationTest(
  'Cuisine and Dining Area catalogs enforce normalized relationships and permissions',
  async () => {
    const denied = await app.inject({
      method: 'POST',
      url: '/cuisines',
      headers: auth(tokenFor(customerAId)),
      payload: { name: 'Denied', type: 'Regional' },
    });
    assert.equal(denied.statusCode, 403);

    const vietnamese = await app.inject({
      method: 'POST',
      url: '/cuisines',
      headers: auth(tokenFor(sousId)),
      payload: {
        name: '  Vietnamese   Food ',
        type: ' Regional ',
        description: 'Traditional dishes',
      },
    });
    assert.equal(vietnamese.statusCode, 201);
    assert.equal(vietnamese.json().name, 'Vietnamese Food');

    const duplicateCuisine = await app.inject({
      method: 'POST',
      url: '/cuisines',
      headers: auth(tokenFor(sousId)),
      payload: { name: 'vietnamese food', type: 'Other' },
    });
    assert.equal(duplicateCuisine.statusCode, 409);

    const vegan = await app.inject({
      method: 'POST',
      url: '/cuisines',
      headers: auth(tokenFor(sousId)),
      payload: { name: 'Vegan', type: 'Dietary' },
    });
    assert.equal(vegan.statusCode, 201);

    const diningArea = await app.inject({
      method: 'POST',
      url: '/dining-areas',
      headers: auth(tokenFor(sousId)),
      payload: {
        name: ' Downtown ',
        address: '12 Main Street',
        description: 'Central lunch area',
      },
    });
    assert.equal(diningArea.statusCode, 201);

    const duplicateArea = await app.inject({
      method: 'POST',
      url: '/dining-areas',
      headers: auth(tokenFor(sousId)),
      payload: { name: 'downtown', address: ' 12  main street ' },
    });
    assert.equal(duplicateArea.statusCode, 409);

    const invalidRestaurant = await app.inject({
      method: 'POST',
      url: '/restaurants',
      headers: auth(tokenFor(sousId)),
      payload: {
        name: 'Invalid catalog restaurant',
        address: '13 Main Street',
        cuisineType: 'Snapshot',
        type: 'Restaurant',
        cuisineIds: [vietnamese.json().id],
        primaryCuisineId: vegan.json().id,
      },
    });
    assert.equal(invalidRestaurant.statusCode, 400);

    const restaurant = await app.inject({
      method: 'POST',
      url: '/restaurants',
      headers: auth(tokenFor(sousId)),
      payload: {
        name: 'Catalog Integration Restaurant',
        address: '13 Main Street',
        cuisineType: 'Compatibility snapshot',
        type: 'Restaurant',
        cuisineIds: [vietnamese.json().id, vegan.json().id],
        primaryCuisineId: vegan.json().id,
        diningAreaId: diningArea.json().id,
      },
    });
    assert.equal(restaurant.statusCode, 201);
    assert.equal(restaurant.json().cuisineType, 'Vegan');
    assert.equal(restaurant.json().cuisines.length, 2);
    assert.equal(restaurant.json().cuisines[0].isPrimary, true);
    assert.equal(restaurant.json().cuisines[0].cuisine.name, 'Vegan');
    assert.equal(restaurant.json().diningArea.name, 'Downtown');

    const cuisineSearch = await app.inject({
      method: 'GET',
      url: '/cuisines?search=vegan&limit=1',
      headers: auth(tokenFor(customerAId)),
    });
    assert.equal(cuisineSearch.statusCode, 200);
    assert.equal(cuisineSearch.json().items[0].name, 'Vegan');
    assert.equal('nameKey' in cuisineSearch.json().items[0], false);

    const protectedCuisine = await app.inject({
      method: 'DELETE',
      url: `/cuisines/${vegan.json().id}`,
      headers: auth(tokenFor(sousId)),
    });
    assert.equal(protectedCuisine.statusCode, 409);
    assert.equal(protectedCuisine.json().code, 'CUISINE_IN_USE');

    const protectedArea = await app.inject({
      method: 'DELETE',
      url: `/dining-areas/${diningArea.json().id}`,
      headers: auth(tokenFor(sousId)),
    });
    assert.equal(protectedArea.statusCode, 409);
    assert.equal(protectedArea.json().code, 'DINING_AREA_IN_USE');

    await prisma.bill.create({
      data: {
        restaurantId: restaurant.json().id,
        createdById: sousId,
        baseCost: 1000,
        vat: 0,
        shippingFee: 0,
        totalCost: 1000,
        participants: {
          create: {
            memberId: customerAId,
            originCost: 1000,
            allocatedVat: 0,
            allocatedShipping: 0,
            discountApplied: 0,
            finalPrice: 1000,
          },
        },
      },
    });
    const stats = await app.inject({
      method: 'GET',
      url: '/stats/me?range=yearly',
      headers: auth(tokenFor(customerAId)),
    });
    assert.equal(stats.statusCode, 200);
    assert.equal(stats.json().byCuisineType.Vegan >= 1000, true);
  },
);

integrationTest(
  'restaurant profiles normalize phone and platform links without legacy JSON',
  async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/restaurants',
      headers: auth(tokenFor(sousId)),
      payload: {
        name: 'Enriched Integration Restaurant',
        address: '2 Test Street',
        cuisineType: 'Vietnamese',
        type: 'Restaurant',
        phone: '0901234567',
        bannerImageUrl: 'https://images.example.test/banner.jpg',
        platformLinks: [
          { platform: 'WEBSITE', url: 'https://example.test/menu' },
          {
            platform: 'OTHER',
            label: 'Reserve',
            url: 'https://booking.example.test/table',
          },
        ],
      },
    });
    assert.equal(created.statusCode, 201);
    const profile = created.json();
    assert.equal(profile.phone, '+84901234567');
    assert.equal(profile.platformLinks.length, 2);
    assert.equal('links' in profile, false);

    const updated = await app.inject({
      method: 'PUT',
      url: `/restaurants/${profile.id}`,
      headers: auth(tokenFor(sousId)),
      payload: {
        phone: null,
        bannerImageUrl: null,
        platformLinks: [profile.platformLinks[1]],
      },
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.json().phone, null);
    assert.equal(updated.json().platformLinks.length, 1);
    assert.equal(updated.json().platformLinks[0].sortOrder, 0);

    const unsafe = await app.inject({
      method: 'PUT',
      url: `/restaurants/${profile.id}`,
      headers: auth(tokenFor(sousId)),
      payload: { bannerImageUrl: 'http://images.example.test/banner.jpg' },
    });
    assert.equal(unsafe.statusCode, 400);
  },
);

integrationTest(
  'bill lifecycle preserves settlement and blocks risky paid edits',
  async () => {
    const customerCreate = await app.inject({
      method: 'POST',
      url: '/bills',
      headers: auth(tokenFor(customerAId)),
      payload: {},
    });
    assert.equal(customerCreate.statusCode, 403);

    const create = await app.inject({
      method: 'POST',
      url: '/bills',
      headers: auth(tokenFor(sousId)),
      payload: {
        restaurantId,
        baseCost: 10001,
        vat: 1001,
        shippingFee: 501,
        paymentUrl: 'https://pay.example.test/bill',
        discounts: [{ type: 'FIXED', value: 500, label: 'Launch' }],
        vouchers: [{ code: 'TEST', value: 100 }],
        participants: [
          { memberId: customerAId, originCost: 5000 },
          { memberId: customerBId, originCost: 5001 },
        ],
      },
    });
    assert.equal(create.statusCode, 201);
    billId = create.json().id;
    assert.equal(JSON.stringify(create.json()).includes('passwordHash'), false);

    const waitingBill = await prisma.bill.create({
      data: {
        restaurantId,
        createdById: sousId,
        baseCost: 6000,
        vat: 0,
        shippingFee: 0,
        totalCost: 6000,
        participants: {
          create: [
            {
              memberId: customerAId,
              originCost: 3000,
              allocatedVat: 0,
              allocatedShipping: 0,
              discountApplied: 0,
              finalPrice: 3000,
            },
            {
              memberId: customerBId,
              originCost: 3000,
              allocatedVat: 0,
              allocatedShipping: 0,
              discountApplied: 0,
              finalPrice: 3000,
            },
          ],
        },
      },
    });
    const waitingEdit = await app.inject({
      method: 'PUT',
      url: `/bills/${waitingBill.id}`,
      headers: auth(tokenFor(sousId)),
      payload: {
        restaurantId,
        baseCost: 6000,
        vat: 0,
        shippingFee: 0,
        participants: [
          { memberId: customerAId, originCost: 3000 },
          { memberId: sousId, originCost: 3000 },
        ],
      },
    });
    assert.equal(waitingEdit.statusCode, 200);
    assert.deepEqual(
      waitingEdit
        .json()
        .participants.map((item: { memberId: string }) => item.memberId)
        .sort(),
      [customerAId, sousId].sort(),
    );
    assert.ok(
      waitingEdit
        .json()
        .participants.every(
          (item: { paymentStatus: string }) =>
            item.paymentStatus === PaymentStatus.WAITING,
        ),
    );

    const paid = await app.inject({
      method: 'PATCH',
      url: `/bills/${billId}/participants/${customerAId}/payment`,
      headers: auth(tokenFor(customerAId)),
      payload: { expectedStatus: 'WAITING', status: 'PAID' },
    });
    assert.equal(paid.statusCode, 200);
    assert.equal(paid.json().paymentStatus, PaymentStatus.PAID);

    const safeEdit = await app.inject({
      method: 'PUT',
      url: `/bills/${billId}`,
      headers: auth(tokenFor(sousId)),
      payload: {
        restaurantId,
        baseCost: 10001,
        vat: 1001,
        shippingFee: 501,
        paymentUrl: 'https://pay.example.test/updated',
        discounts: [{ type: 'FIXED', value: 500, label: 'Launch' }],
        vouchers: [{ code: 'TEST', value: 100 }],
        participants: [
          { memberId: customerAId, originCost: 5000 },
          { memberId: customerBId, originCost: 5001 },
        ],
      },
    });
    assert.equal(safeEdit.statusCode, 200);
    assert.equal(
      safeEdit
        .json()
        .participants.find(
          (item: { memberId: string }) => item.memberId === customerAId,
        ).paymentStatus,
      PaymentStatus.PAID,
    );

    const riskyEdit = await app.inject({
      method: 'PUT',
      url: `/bills/${billId}`,
      headers: auth(tokenFor(sousId)),
      payload: {
        restaurantId,
        baseCost: 10001,
        vat: 1002,
        shippingFee: 501,
        participants: [
          { memberId: customerAId, originCost: 5000 },
          { memberId: customerBId, originCost: 5001 },
        ],
      },
    });
    assert.equal(riskyEdit.statusCode, 409);
    assert.equal(riskyEdit.json().code, 'PAID_BILL_AMENDMENT_BLOCKED');

    const archive = await app.inject({
      method: 'PATCH',
      url: `/bills/${billId}/archive`,
      headers: auth(tokenFor(headId)),
    });
    assert.equal(archive.statusCode, 200);
    const restore = await app.inject({
      method: 'PATCH',
      url: `/bills/${billId}/restore`,
      headers: auth(tokenFor(headId)),
    });
    assert.equal(restore.statusCode, 200);
  },
);

integrationTest(
  'payment correction, audit, notification ownership, and reminder cooldown work',
  async () => {
    const corrected = await app.inject({
      method: 'PATCH',
      url: `/bills/${billId}/participants/${customerAId}/payment`,
      headers: auth(tokenFor(sousId)),
      payload: { expectedStatus: 'PAID', status: 'WAITING' },
    });
    assert.equal(corrected.statusCode, 200);
    assert.equal(corrected.json().paymentStatus, PaymentStatus.WAITING);
    assert.equal(
      await prisma.billAuditLog.count({
        where: { billId, action: 'PAYMENT_STATUS_CHANGED' },
      }),
      2,
    );

    const foreignNotification = await prisma.notification.create({
      data: { userId: customerBId, billId, message: 'Private reminder' },
    });
    const foreignRead = await app.inject({
      method: 'PATCH',
      url: `/notifications/${foreignNotification.id}/read`,
      headers: auth(tokenFor(customerAId)),
    });
    assert.equal(foreignRead.statusCode, 404);

    const firstReminder = await app.inject({
      method: 'POST',
      url: `/bills/${billId}/reminders`,
      headers: auth(tokenFor(sousId)),
    });
    assert.equal(firstReminder.statusCode, 200);
    assert.ok(firstReminder.json().sent >= 1);
    const secondReminder = await app.inject({
      method: 'POST',
      url: `/bills/${billId}/reminders`,
      headers: auth(tokenFor(sousId)),
    });
    assert.equal(secondReminder.statusCode, 200);
    assert.equal(secondReminder.json().sent, 0);
    assert.ok(secondReminder.json().skipped >= 1);

    const activity = await app.inject({
      method: 'GET',
      url: `/bills/${billId}/activity`,
      headers: auth(tokenFor(customerAId)),
    });
    assert.equal(activity.statusCode, 200);
    const actions = new Set(
      activity.json().map((event: { action: string }) => event.action),
    );
    for (const action of [
      'CREATED',
      'UPDATED',
      'PAYMENT_STATUS_CHANGED',
      'ARCHIVED',
      'RESTORED',
      'REMINDERS_SENT',
    ]) {
      assert.ok(actions.has(action));
    }
    assert.equal(JSON.stringify(activity.json()).includes('before'), false);
    assert.equal(JSON.stringify(activity.json()).includes('after'), false);
    assert.equal(
      JSON.stringify(activity.json()).includes('passwordHash'),
      false,
    );
  },
);

integrationTest('validation failures use stable client contracts', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/bills',
    headers: auth(tokenFor(sousId)),
    payload: { restaurantId },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(response.json().issues));
});

integrationTest(
  'password change keeps one fresh session and invalidates every older token',
  async () => {
    const legacyToken = tokenFor(customerBId);
    const legacyBeforeChange = await app.inject({
      method: 'GET',
      url: '/me',
      headers: auth(legacyToken),
    });
    assert.equal(legacyBeforeChange.statusCode, 200);

    const firstLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { identifier: 'customer-b-int', password: 'password123' },
    });
    const secondLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { identifier: 'customer-b-int', password: 'password123' },
    });
    assert.equal(firstLogin.statusCode, 200);
    assert.equal(secondLogin.statusCode, 200);

    const cases = [
      {
        payload: {
          currentPassword: 'password123',
          newPassword: 'short',
          confirmation: 'short',
        },
        status: 400,
        code: 'PASSWORD_LENGTH_INVALID',
      },
      {
        payload: {
          currentPassword: 'password123',
          newPassword: 'new-password-123',
          confirmation: 'different-password',
        },
        status: 400,
        code: 'PASSWORD_CONFIRMATION_MISMATCH',
      },
      {
        payload: {
          currentPassword: 'wrong-password',
          newPassword: 'new-password-123',
          confirmation: 'new-password-123',
        },
        status: 403,
        code: 'CURRENT_PASSWORD_INVALID',
      },
      {
        payload: {
          currentPassword: 'password123',
          newPassword: 'password123',
          confirmation: 'password123',
        },
        status: 409,
        code: 'PASSWORD_REUSE_FORBIDDEN',
      },
    ];
    for (const item of cases) {
      const response = await app.inject({
        method: 'PATCH',
        url: '/me/password',
        headers: auth(firstLogin.json().token),
        payload: item.payload,
      });
      assert.equal(response.statusCode, item.status);
      assert.equal(response.json().code, item.code);
    }

    const changed = await app.inject({
      method: 'PATCH',
      url: '/me/password',
      headers: auth(firstLogin.json().token),
      payload: {
        currentPassword: 'password123',
        newPassword: 'new-password-123',
        confirmation: 'new-password-123',
      },
    });
    assert.equal(changed.statusCode, 200);
    assert.equal(typeof changed.json().token, 'string');
    assert.equal(
      JSON.stringify(changed.json()).includes('passwordHash'),
      false,
    );

    for (const oldToken of [legacyToken, secondLogin.json().token]) {
      const invalidated = await app.inject({
        method: 'GET',
        url: '/me',
        headers: auth(oldToken),
      });
      assert.equal(invalidated.statusCode, 401);
      assert.equal(invalidated.json().code, 'SESSION_INVALIDATED');
    }
    const currentSession = await app.inject({
      method: 'GET',
      url: '/me',
      headers: auth(changed.json().token),
    });
    assert.equal(currentSession.statusCode, 200);

    const oldPasswordLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { identifier: 'customer-b-int', password: 'password123' },
    });
    assert.equal(oldPasswordLogin.statusCode, 401);
    const newPasswordLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        identifier: 'customer-b-int',
        password: 'new-password-123',
      },
    });
    assert.equal(newPasswordLogin.statusCode, 200);

    const restored = await app.inject({
      method: 'PATCH',
      url: '/me/password',
      headers: auth(newPasswordLogin.json().token),
      payload: {
        currentPassword: 'new-password-123',
        newPassword: 'password123',
        confirmation: 'password123',
      },
    });
    assert.equal(restored.statusCode, 200);
  },
);

integrationTest(
  'password recovery is opaque, root-assisted, hashed, single-use, and invalidates sessions',
  async () => {
    const missing = await app.inject({
      method: 'POST',
      url: '/auth/password-reset-requests',
      payload: { identifier: 'missing-account-int' },
    });
    const requested = await app.inject({
      method: 'POST',
      url: '/auth/password-reset-requests',
      payload: { identifier: 'customer-a-int' },
    });
    assert.equal(missing.statusCode, 202);
    assert.deepEqual(missing.json(), requested.json());

    const list = await app.inject({
      method: 'GET',
      url: '/admin/password-reset-requests',
      headers: auth(tokenFor(rootId)),
    });
    assert.equal(list.statusCode, 200);
    const listed = list
      .json()
      .find((item: { user: { id: string } }) => item.user.id === customerAId);
    assert.ok(listed);
    assert.equal('codeHash' in listed, false);

    const issued = await app.inject({
      method: 'POST',
      url: `/admin/password-reset-requests/${listed.id}/issue`,
      headers: auth(tokenFor(rootId)),
    });
    assert.equal(issued.statusCode, 200);
    assert.match(issued.json().code, /^[2-9A-HJ-NP-Z]{8}$/);
    const stored = await prisma.passwordResetRequest.findUniqueOrThrow({
      where: { id: listed.id },
    });
    assert.notEqual(stored.codeHash, issued.json().code);
    assert.ok(await bcrypt.compare(issued.json().code, stored.codeHash!));

    const oldSession = tokenFor(customerAId);
    const consumed = await app.inject({
      method: 'POST',
      url: '/auth/password-reset',
      payload: {
        identifier: 'customer-a-int',
        code: issued.json().code,
        newPassword: 'recovered-password-123',
        confirmation: 'recovered-password-123',
      },
    });
    assert.equal(consumed.statusCode, 200);
    const replay = await app.inject({
      method: 'POST',
      url: '/auth/password-reset',
      payload: {
        identifier: 'customer-a-int',
        code: issued.json().code,
        newPassword: 'another-password-123',
        confirmation: 'another-password-123',
      },
    });
    assert.equal(replay.statusCode, 400);
    assert.equal(replay.json().code, 'PASSWORD_RESET_INVALID');
    const invalidated = await app.inject({
      method: 'GET',
      url: '/me',
      headers: auth(oldSession),
    });
    assert.equal(invalidated.statusCode, 401);
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        identifier: 'customer-a-int',
        password: 'recovered-password-123',
      },
    });
    assert.equal(login.statusCode, 200);
    const restoredPassword = await app.inject({
      method: 'PATCH',
      url: '/me/password',
      headers: auth(login.json().token),
      payload: {
        currentPassword: 'recovered-password-123',
        newPassword: 'password123',
        confirmation: 'password123',
      },
    });
    assert.equal(restoredPassword.statusCode, 200);

    await app.inject({
      method: 'POST',
      url: '/auth/password-reset-requests',
      payload: { identifier: 'root-int' },
    });
    const rootRequest = await prisma.passwordResetRequest.findFirstOrThrow({
      where: { userId: rootId, activeKey: rootId },
    });
    const ownApproval = await app.inject({
      method: 'POST',
      url: `/admin/password-reset-requests/${rootRequest.id}/issue`,
      headers: auth(tokenFor(rootId)),
    });
    assert.equal(ownApproval.statusCode, 403);
    assert.equal(ownApproval.json().code, 'ROOT_RESET_REQUIRES_OPERATOR');

    await app.inject({
      method: 'POST',
      url: '/auth/password-reset-requests',
      payload: { identifier: 'customer-b-int' },
    });
    let limitedRequest = await prisma.passwordResetRequest.findFirstOrThrow({
      where: { userId: customerBId, activeKey: customerBId },
    });
    const limitedIssue = await app.inject({
      method: 'POST',
      url: `/admin/password-reset-requests/${limitedRequest.id}/issue`,
      headers: auth(tokenFor(rootId)),
    });
    assert.equal(limitedIssue.statusCode, 200);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failure = await app.inject({
        method: 'POST',
        url: '/auth/password-reset',
        payload: {
          identifier: 'customer-b-int',
          code: 'AAAAAAAA',
          newPassword: 'unused-password-123',
          confirmation: 'unused-password-123',
        },
      });
      assert.equal(failure.statusCode, 400);
    }
    limitedRequest = await prisma.passwordResetRequest.findUniqueOrThrow({
      where: { id: limitedRequest.id },
    });
    assert.equal(limitedRequest.status, 'LOCKED');
    const lockedCode = await app.inject({
      method: 'POST',
      url: '/auth/password-reset',
      payload: {
        identifier: 'customer-b-int',
        code: limitedIssue.json().code,
        newPassword: 'unused-password-123',
        confirmation: 'unused-password-123',
      },
    });
    assert.equal(lockedCode.statusCode, 400);

    await app.inject({
      method: 'POST',
      url: '/auth/password-reset-requests',
      payload: { identifier: 'customer-b-int' },
    });
    const expiringRequest = await prisma.passwordResetRequest.findFirstOrThrow({
      where: { userId: customerBId, activeKey: customerBId },
    });
    const expiringIssue = await app.inject({
      method: 'POST',
      url: `/admin/password-reset-requests/${expiringRequest.id}/issue`,
      headers: auth(tokenFor(rootId)),
    });
    await prisma.passwordResetRequest.update({
      where: { id: expiringRequest.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const expired = await app.inject({
      method: 'POST',
      url: '/auth/password-reset',
      payload: {
        identifier: 'customer-b-int',
        code: expiringIssue.json().code,
        newPassword: 'unused-password-123',
        confirmation: 'unused-password-123',
      },
    });
    assert.equal(expired.statusCode, 400);
    assert.equal(
      (
        await prisma.passwordResetRequest.findUniqueOrThrow({
          where: { id: expiringRequest.id },
        })
      ).status,
      'EXPIRED',
    );
  },
);

integrationTest(
  'root transfer is audited, conflict-safe, and invalidates both sessions',
  async () => {
    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/admin/root-transfer',
      headers: auth(tokenFor(rootId)),
      payload: {
        currentPassword: 'wrong-password',
        targetUsername: 'customer-a-int',
        confirmationUsername: 'customer-a-int',
      },
    });
    assert.equal(wrongPassword.statusCode, 403);
    assert.equal(wrongPassword.json().code, 'ROOT_TRANSFER_PASSWORD_INVALID');

    const results = await Promise.allSettled([
      transferRootAdmin({
        currentUserId: rootId,
        currentPassword: 'password123',
        targetUsername: 'customer-a-int',
        confirmationUsername: 'customer-a-int',
      }),
      transferRootAdmin({
        currentUserId: rootId,
        currentPassword: 'password123',
        targetUsername: 'customer-b-int',
        confirmationUsername: 'customer-b-int',
      }),
    ]);
    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    const rejected = results.find((result) => result.status === 'rejected');
    assert.ok(rejected && rejected.status === 'rejected');
    assert.ok(rejected.reason instanceof RootAdminTransferError);
    assert.equal(rejected.reason.code, 'ROOT_TRANSFER_CONFLICT');

    const newRoot = await prisma.user.findFirstOrThrow({
      where: { systemRole: SystemRole.ROOT_ADMIN },
    });
    assert.ok([customerAId, customerBId].includes(newRoot.id));
    assert.equal(await prisma.rootAdminTransferAudit.count(), 1);

    const oldRootSession = await app.inject({
      method: 'GET',
      url: '/me',
      headers: auth(tokenFor(rootId)),
    });
    assert.equal(oldRootSession.statusCode, 401);
    assert.equal(oldRootSession.json().code, 'SESSION_INVALIDATED');
    const newRootOldSession = await app.inject({
      method: 'GET',
      url: '/me',
      headers: auth(tokenFor(newRoot.id)),
    });
    assert.equal(newRootOldSession.statusCode, 401);

    const freshNewRootToken = tokenFor(
      newRoot.id,
      '8h',
      newRoot.sessionVersion,
    );
    const transferBack = await app.inject({
      method: 'POST',
      url: '/admin/root-transfer',
      headers: auth(freshNewRootToken),
      payload: {
        currentPassword: 'password123',
        targetUsername: 'root-int',
        confirmationUsername: 'root-int',
      },
    });
    assert.equal(transferBack.statusCode, 200);
    assert.equal(await prisma.rootAdminTransferAudit.count(), 2);
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: rootId } }))
        .systemRole,
      SystemRole.ROOT_ADMIN,
    );
  },
);
