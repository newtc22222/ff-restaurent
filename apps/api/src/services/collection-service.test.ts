import assert from 'node:assert/strict';
import test from 'node:test';

import { isCollectionPublicationTransition } from './collection-service.js';

test('collection publication only fires on a private to public transition', () => {
  assert.equal(isCollectionPublicationTransition(false, true), true);
  assert.equal(isCollectionPublicationTransition(true, true), false);
  assert.equal(isCollectionPublicationTransition(true, false), false);
  assert.equal(isCollectionPublicationTransition(false, undefined), false);
});
