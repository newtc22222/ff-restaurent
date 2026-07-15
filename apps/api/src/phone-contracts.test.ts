import assert from 'node:assert/strict';
import test from 'node:test';
import { profileUpdateSchema, registerSchema } from './schemas.js';

test('registration normalizes Vietnamese mobile phones to E.164', () => {
  const result = registerSchema.parse({
    name: 'Phone Member',
    username: 'phone-member',
    phone: '0901 234 567',
    password: 'password123',
    inviteCode: 'invite',
  });
  assert.equal(result.phone, '+84901234567');
});

test('profile phone accepts an explicit clear', () => {
  assert.equal(profileUpdateSchema.parse({ phone: '' }).phone, null);
  assert.equal(profileUpdateSchema.parse({ phone: null }).phone, null);
});

test('phone schemas reject non-mobile or non-Vietnamese numbers', () => {
  assert.throws(() =>
    registerSchema.parse({
      name: 'Phone Member',
      username: 'phone-member',
      phone: '+12025550123',
      password: 'password123',
      inviteCode: 'invite',
    }),
  );
});
