import assert from 'node:assert/strict';
import test from 'node:test';
import {
  billActivityActorSelect,
  billResponseInclude,
  paymentResponseInclude,
} from './bill-routes.js';
import { publicUserSelect } from '../roles.js';

const expectedPublicUserFields = [
    'avatarUrl',
    'chefRole',
  'createdAt',
  'id',
  'name',
  'phone',
  'systemRole',
  'username',
];

const assertPublicUserContract = (select: typeof publicUserSelect) => {
  assert.deepEqual(Object.keys(select).sort(), expectedPublicUserFields);
  assert.equal('passwordHash' in select, false);
  assert.equal('sessionVersion' in select, false);
};

test('bill list, detail, create, edit, archive, and restore responses select only public users', () => {
  assert.strictEqual(billResponseInclude.createdBy.select, publicUserSelect);
  assert.strictEqual(
    billResponseInclude.participants.include.member.select,
    publicUserSelect,
  );
  assertPublicUserContract(billResponseInclude.createdBy.select);
  assertPublicUserContract(
    billResponseInclude.participants.include.member.select,
  );
});

test('payment update responses select only public participant users', () => {
  assert.strictEqual(paymentResponseInclude.member.select, publicUserSelect);
  assertPublicUserContract(paymentResponseInclude.member.select);
});

test('bill activity exposes only the actor identity needed by the timeline', () => {
  assert.deepEqual(Object.keys(billActivityActorSelect).sort(), [
    'id',
    'name',
    'username',
  ]);
  assert.equal('passwordHash' in billActivityActorSelect, false);
  assert.equal('phone' in billActivityActorSelect, false);
});
