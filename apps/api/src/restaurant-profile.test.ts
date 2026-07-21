import assert from 'node:assert/strict';
import test from 'node:test';
import {
  type PublicRestaurantRecord,
  buildPublicRestaurantSelect,
  serializePublicRestaurant,
} from './restaurant-contract.js';
import { restaurantSchema } from './schemas.js';

const base = {
  name: 'Profile Restaurant',
  address: 'Manual address',
  cuisineType: 'Vietnamese',
  type: 'Restaurant',
};

test('restaurant profiles normalize optional phone and ordered platform input', () => {
  const parsed = restaurantSchema.parse({
    ...base,
    phone: '0901234567',
    bannerImageUrl: 'https://images.example.test/banner.jpg#preview',
    platformLinks: [
      {
        platform: 'WEBSITE',
        label: 'Ignored label',
        url: 'https://example.test/menu#lunch',
      },
      {
        platform: 'OTHER',
        label: 'Delivery partner',
        url: 'https://delivery.example.test/order',
      },
    ],
  });

  assert.equal(parsed.phone, '+84901234567');
  assert.equal(parsed.bannerImageUrl, 'https://images.example.test/banner.jpg');
  assert.deepEqual(parsed.platformLinks, [
    {
      platform: 'WEBSITE',
      label: null,
      url: 'https://example.test/menu',
    },
    {
      platform: 'OTHER',
      label: 'Delivery partner',
      url: 'https://delivery.example.test/order',
    },
  ]);
});

test('restaurant profiles reject unsafe URLs, missing labels, and duplicates', () => {
  const rejected = [
    { ...base, bannerImageUrl: 'http://images.example.test/banner.jpg' },
    {
      ...base,
      platformLinks: [{ platform: 'WEBSITE', url: 'http://example.test' }],
    },
    {
      ...base,
      platformLinks: [{ platform: 'OTHER', url: 'https://example.test' }],
    },
    {
      ...base,
      platformLinks: [
        { platform: 'GRAB', url: 'https://grab.com/one' },
        { platform: 'GRAB', url: 'https://grab.com/two' },
      ],
    },
    {
      ...base,
      platformLinks: [
        { platform: 'WEBSITE', url: 'https://example.test' },
        {
          platform: 'OTHER',
          label: 'Duplicate',
          url: 'https://example.test/',
        },
      ],
    },
  ];

  for (const input of rejected) {
    assert.equal(restaurantSchema.safeParse(input).success, false);
  }
});

test('public restaurant selection never exposes legacy JSON links', () => {
  const select = buildPublicRestaurantSelect('user-1');
  assert.equal('links' in select, false);
  assert.equal(select.platformLinks.orderBy.sortOrder, 'asc');
});

test('public restaurant selection scopes favorite memberships to the viewer', () => {
  const anonymous = buildPublicRestaurantSelect();
  assert.deepEqual(anonymous.collections.where.collection.OR, [
    { systemType: 'RECOMMENDED' },
  ]);

  const scoped = buildPublicRestaurantSelect('user-1');
  assert.deepEqual(scoped.collections.where.collection.OR, [
    { systemType: 'RECOMMENDED' },
    { systemType: 'FAVORITES', ownerId: 'user-1' },
  ]);
});

test('legacy link input is accepted but translated out of the new contract', () => {
  const parsed = restaurantSchema.parse({
    ...base,
    links: [{ label: 'Old client', url: 'http://legacy.example.test/menu' }],
  });
  assert.equal('links' in parsed, false);
  assert.deepEqual(parsed.platformLinks, [
    {
      platform: 'OTHER',
      label: 'Old client',
      url: 'http://legacy.example.test/menu',
    },
  ]);
});

test('normalized cuisines and Collections derive the legacy response aliases', () => {
  const restaurant = {
    id: 'restaurant-1',
    cuisines: [
      {
        isPrimary: true,
        cuisine: {
          id: 'cuisine-1',
          name: 'Vietnamese',
          type: 'Regional',
          description: null,
        },
      },
    ],
    collections: [
      { collection: { systemType: 'RECOMMENDED', ownerId: null } },
      { collection: { systemType: 'FAVORITES', ownerId: 'user-1' } },
    ],
  } as PublicRestaurantRecord;
  const response = serializePublicRestaurant(restaurant, 'user-1');
  assert.equal(response.cuisineType, 'Vietnamese');
  assert.equal(response.isRecommended, true);
  assert.equal(response.isFavoritedByMe, true);
  assert.equal(response.isFavorite, true);
  assert.equal('collections' in response, false);
});
