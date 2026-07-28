import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('generated transport composes with shared domain enums', async () => {
  const generated = await readFile(
    new URL('../apps/web/src/api/generated/api-types.ts', import.meta.url),
    'utf8',
  );

  for (const member of [
    'SOUS_CHEF',
    'HEAD_CHEF',
    'ROOT_ADMIN',
    'ACTIVE',
    'ARCHIVED',
    'PAID',
    'WAITING',
    'SHOPEE_FOOD',
    'FAVORITES',
    'RECOMMENDED',
    'PROPORTIONAL',
    'PERCENTAGE',
  ]) {
    assert.doesNotMatch(
      generated,
      new RegExp(`["']${member}["']`),
      `${member} must come from @ff-restaurent/shared`,
    );
  }

  assert.match(generated, /CollectionSystemTypeValue \| ["']custom["']/);
});
