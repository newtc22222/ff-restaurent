import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSearchQuery } from './search-normalization.js';

test('normalizes Vietnamese search text consistently', () => {
  assert.equal(
    normalizeSearchQuery('  Bếp   Việt Đậm Đà  '),
    'bep viet dam da',
  );
  assert.equal(
    normalizeSearchQuery('ĐƯỜNG TRẦN HƯNG ĐẠO'),
    'duong tran hung dao',
  );
});
