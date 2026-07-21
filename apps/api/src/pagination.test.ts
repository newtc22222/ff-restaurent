import assert from 'node:assert/strict';
import test from 'node:test';
import { cursorPageResult } from './pagination.js';

test('cursor pages expose stable forward and backward boundaries', () => {
  assert.deepEqual(cursorPageResult([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 2, false), {
    items: [{ id: 'a' }, { id: 'b' }],
    pageInfo: {
      startCursor: 'a',
      endCursor: 'b',
      hasPreviousPage: false,
      hasNextPage: true,
    },
  });
  assert.deepEqual(
    cursorPageResult([{ id: 'c' }, { id: 'b' }, { id: 'a' }], 2, true, 'd'),
    {
      items: [{ id: 'b' }, { id: 'c' }],
      pageInfo: {
        startCursor: 'b',
        endCursor: 'c',
        hasPreviousPage: true,
        hasNextPage: true,
      },
    },
  );
});
