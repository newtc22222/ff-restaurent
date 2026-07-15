import assert from 'node:assert/strict';
import test from 'node:test';
import { findCuisineCollisions, planLegacyLinks } from './phase2-backfill.js';

test('legacy link planning keeps valid HTTPS links and reports unsafe values', () => {
  const plan = planLegacyLinks('restaurant-1', [
    { label: ' Menu ', url: 'https://example.test/menu' },
    { label: 'Unsafe', url: 'http://example.test' },
    { label: 'Missing' },
  ]);

  assert.deepEqual(plan.candidates, [
    { label: 'Menu', url: 'https://example.test/menu' },
  ]);
  assert.deepEqual(
    plan.exceptions.map((exception) => ({
      kind: exception.kind,
      field: exception.field,
    })),
    [
      { kind: 'LEGACY_LINK_INVALID', field: 'links.1.url' },
      { kind: 'LEGACY_LINK_INVALID', field: 'links.2.url' },
    ],
  );
});

test('normalized cuisine collisions are observable without losing restaurant ids', () => {
  const collisions = findCuisineCollisions([
    { id: 'a', cuisineType: 'Thai  Food' },
    { id: 'b', cuisineType: ' thai food ' },
    { id: 'c', cuisineType: 'Vietnamese' },
  ]);

  assert.equal(collisions.length, 1);
  assert.equal(collisions[0]?.kind, 'CUISINE_NORMALIZED_COLLISION');
  assert.equal(collisions[0]?.field, 'thai food');
  assert.equal(collisions[0]?.value, 'a,b');
});
