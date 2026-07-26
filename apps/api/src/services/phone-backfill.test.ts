import assert from 'node:assert/strict';
import test from 'node:test';
import { planUserPhoneBackfill } from './phone-backfill.js';

test('phone backfill plans canonical updates without exposing full phones', () => {
  const plan = planUserPhoneBackfill([
    { id: 'local', phone: '0901 234 567' },
    { id: 'canonical', phone: '+84981234567' },
    { id: 'invalid', phone: 'not-a-phone' },
  ]);

  assert.deepEqual(plan.updates, [{ id: 'local', phone: '+84901234567' }]);
  assert.deepEqual(plan.invalid, [{ id: 'invalid', maskedPhone: 'not***ne' }]);
  assert.deepEqual(plan.collisions, []);
  assert.equal(JSON.stringify(plan.invalid).includes('not-a-phone'), false);
});

test('phone backfill blocks canonical collisions before updating', () => {
  const plan = planUserPhoneBackfill([
    { id: 'a', phone: '0901234567' },
    { id: 'b', phone: '+84901234567' },
  ]);

  assert.deepEqual(plan.updates, []);
  assert.deepEqual(plan.collisions, [
    { maskedPhone: '+84***67', userIds: ['a', 'b'] },
  ]);
});
