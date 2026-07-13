import assert from 'node:assert/strict';
import test from 'node:test';
import { billResponseInclude, paymentResponseInclude } from './bill-routes.js';
import { publicUserSelect } from '../roles.js';

const expectedPublicUserFields = [
  'chefRole',
  'createdAt',
  'id',
  'name',
  'phone',
  'username',
];

const assertPublicUserContract = (select: typeof publicUserSelect) => {
  assert.deepEqual(Object.keys(select).sort(), expectedPublicUserFields);
  assert.equal('passwordHash' in select, false);
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
