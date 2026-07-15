import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ChefRole, PaymentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { prisma } from './prisma.js';

const integrationTest =
  process.env.RUN_INTEGRATION_TESTS === '1' ? test : test.skip;

let app: FastifyInstance;
let headId: string;
let sousId: string;
let customerAId: string;
let customerBId: string;
let restaurantId: string;
let billId: string;

const tokenFor = (id: string, expiresIn = '8h') =>
  app.jwt.sign({ sub: id }, { expiresIn });
const auth = (token: string) => ({ authorization: `Bearer ${token}` });

before(async () => {
  if (process.env.RUN_INTEGRATION_TESTS !== '1') return;
  process.env.JWT_SECRET ??=
    'integration-secret-that-is-at-least-32-characters';
  process.env.REGISTRATION_INVITE_CODE ??= 'integration-invite';
  app = await buildApp();
  await prisma.notification.deleteMany();
  await prisma.billAuditLog.deleteMany();
  await prisma.roleAuditLog.deleteMany();
  await prisma.billParticipant.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.userFavorite.deleteMany();
  await prisma.restaurantEntry.deleteMany();
  await prisma.user.deleteMany();
  const passwordHash = await bcrypt.hash('password123', 4);
  const [head, sous, customerA, customerB] = await Promise.all([
    prisma.user.create({
      data: {
        username: 'head-int',
        name: 'Head',
        passwordHash,
        chefRole: ChefRole.HEAD_CHEF,
      },
    }),
    prisma.user.create({
      data: {
        username: 'sous-int',
        name: 'Sous',
        passwordHash,
        chefRole: ChefRole.SOUS_CHEF,
      },
    }),
    prisma.user.create({
      data: { username: 'customer-a-int', name: 'Customer A', passwordHash },
    }),
    prisma.user.create({
      data: { username: 'customer-b-int', name: 'Customer B', passwordHash },
    }),
  ]);
  headId = head.id;
  sousId = sous.id;
  customerAId = customerA.id;
  customerBId = customerB.id;
  restaurantId = (
    await prisma.restaurantEntry.create({
      data: {
        name: 'Integration Restaurant',
        address: '1 Test Street',
        cuisineType: 'Test',
        type: 'Restaurant',
        createdById: sousId,
      },
    })
  ).id;
});

after(async () => {
  if (process.env.RUN_INTEGRATION_TESTS !== '1') return;
  await app.close();
  await prisma.$disconnect();
});

integrationTest(
  'onboarding is invite-gated and tokens are enforced',
  async () => {
    const denied = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name: 'Denied',
        username: 'denied-user',
        password: 'password123',
        inviteCode: 'wrong-code',
      },
    });
    assert.equal(denied.statusCode, 403);
    assert.equal(denied.json().code, 'REGISTRATION_NOT_AUTHORIZED');

    const allowed = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name: 'Invited',
        username: 'invited-user',
        password: 'password123',
        inviteCode: process.env.REGISTRATION_INVITE_CODE,
      },
    });
    assert.equal(allowed.statusCode, 201);
    assert.equal('passwordHash' in allowed.json().user, false);

    const invalid = await app.inject({
      method: 'GET',
      url: '/me',
      headers: auth('invalid-token'),
    });
    assert.equal(invalid.statusCode, 401);

    const expired = await app.inject({
      method: 'GET',
      url: '/me',
      headers: auth(tokenFor(customerAId, '-1s')),
    });
    assert.equal(expired.statusCode, 401);
  },
);

integrationTest(
  'Vietnamese phone normalization, login precedence, duplicates, and clearing work',
  async () => {
    const register = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name: 'Phone Member',
        username: 'phone-member-int',
        phone: '0901 234 567',
        password: 'phone-password',
        inviteCode: process.env.REGISTRATION_INVITE_CODE,
      },
    });
    assert.equal(register.statusCode, 201);
    assert.equal(register.json().user.phone, '+84901234567');

    const phoneLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { identifier: '0901234567', password: 'phone-password' },
    });
    assert.equal(phoneLogin.statusCode, 200);
    assert.equal(phoneLogin.json().user.username, 'phone-member-int');

    await prisma.user.create({
      data: {
        name: 'Phone-looking Username',
        username: '0901234567',
        passwordHash: await bcrypt.hash('username-password', 4),
      },
    });
    const usernameLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { identifier: '0901234567', password: 'username-password' },
    });
    assert.equal(usernameLogin.statusCode, 200);
    assert.equal(usernameLogin.json().user.username, '0901234567');

    const duplicate = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name: 'Duplicate Phone',
        username: 'duplicate-phone-int',
        phone: '+84901234567',
        password: 'password123',
        inviteCode: process.env.REGISTRATION_INVITE_CODE,
      },
    });
    assert.equal(duplicate.statusCode, 409);
    assert.equal(duplicate.json().code, 'IDENTIFIER_TAKEN');

    const invalid = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name: 'Invalid Phone',
        username: 'invalid-phone-int',
        phone: '+12025550123',
        password: 'password123',
        inviteCode: process.env.REGISTRATION_INVITE_CODE,
      },
    });
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.json().code, 'VALIDATION_ERROR');

    const clear = await app.inject({
      method: 'PUT',
      url: '/me/profile',
      headers: auth(register.json().token),
      payload: { phone: '' },
    });
    assert.equal(clear.statusCode, 200);
    assert.equal(clear.json().phone, null);
  },
);

integrationTest(
  'role boundaries and final Head Chef safeguards hold',
  async () => {
    const denied = await app.inject({
      method: 'GET',
      url: '/users',
      headers: auth(tokenFor(customerAId)),
    });
    assert.equal(denied.statusCode, 403);

    const selfChange = await app.inject({
      method: 'PATCH',
      url: `/users/${headId}/chef-role`,
      headers: auth(tokenFor(headId)),
      payload: { chefRole: null },
    });
    assert.equal(selfChange.statusCode, 403);
    assert.equal(selfChange.json().code, 'SELF_ROLE_CHANGE_FORBIDDEN');
    assert.equal(
      await prisma.user.count({ where: { chefRole: ChefRole.HEAD_CHEF } }),
      1,
    );
  },
);

integrationTest(
  'bill lifecycle preserves settlement and blocks risky paid edits',
  async () => {
    const customerCreate = await app.inject({
      method: 'POST',
      url: '/bills',
      headers: auth(tokenFor(customerAId)),
      payload: {},
    });
    assert.equal(customerCreate.statusCode, 403);

    const create = await app.inject({
      method: 'POST',
      url: '/bills',
      headers: auth(tokenFor(sousId)),
      payload: {
        restaurantId,
        baseCost: 10001,
        vat: 1001,
        shippingFee: 501,
        paymentUrl: 'https://pay.example.test/bill',
        discounts: [{ type: 'FIXED', value: 500, label: 'Launch' }],
        vouchers: [{ code: 'TEST', value: 100 }],
        participants: [
          { memberId: customerAId, originCost: 5000 },
          { memberId: customerBId, originCost: 5001 },
        ],
      },
    });
    assert.equal(create.statusCode, 201);
    billId = create.json().id;
    assert.equal(JSON.stringify(create.json()).includes('passwordHash'), false);

    const waitingBill = await prisma.bill.create({
      data: {
        restaurantId,
        createdById: sousId,
        baseCost: 6000,
        vat: 0,
        shippingFee: 0,
        totalCost: 6000,
        participants: {
          create: [
            {
              memberId: customerAId,
              originCost: 3000,
              allocatedVat: 0,
              allocatedShipping: 0,
              discountApplied: 0,
              finalPrice: 3000,
            },
            {
              memberId: customerBId,
              originCost: 3000,
              allocatedVat: 0,
              allocatedShipping: 0,
              discountApplied: 0,
              finalPrice: 3000,
            },
          ],
        },
      },
    });
    const waitingEdit = await app.inject({
      method: 'PUT',
      url: `/bills/${waitingBill.id}`,
      headers: auth(tokenFor(sousId)),
      payload: {
        restaurantId,
        baseCost: 6000,
        vat: 0,
        shippingFee: 0,
        participants: [
          { memberId: customerAId, originCost: 3000 },
          { memberId: sousId, originCost: 3000 },
        ],
      },
    });
    assert.equal(waitingEdit.statusCode, 200);
    assert.deepEqual(
      waitingEdit
        .json()
        .participants.map((item: { memberId: string }) => item.memberId)
        .sort(),
      [customerAId, sousId].sort(),
    );
    assert.ok(
      waitingEdit
        .json()
        .participants.every(
          (item: { paymentStatus: string }) =>
            item.paymentStatus === PaymentStatus.WAITING,
        ),
    );

    const paid = await app.inject({
      method: 'PATCH',
      url: `/bills/${billId}/participants/${customerAId}/payment`,
      headers: auth(tokenFor(customerAId)),
      payload: { expectedStatus: 'WAITING', status: 'PAID' },
    });
    assert.equal(paid.statusCode, 200);
    assert.equal(paid.json().paymentStatus, PaymentStatus.PAID);

    const safeEdit = await app.inject({
      method: 'PUT',
      url: `/bills/${billId}`,
      headers: auth(tokenFor(sousId)),
      payload: {
        restaurantId,
        baseCost: 10001,
        vat: 1001,
        shippingFee: 501,
        paymentUrl: 'https://pay.example.test/updated',
        discounts: [{ type: 'FIXED', value: 500, label: 'Launch' }],
        vouchers: [{ code: 'TEST', value: 100 }],
        participants: [
          { memberId: customerAId, originCost: 5000 },
          { memberId: customerBId, originCost: 5001 },
        ],
      },
    });
    assert.equal(safeEdit.statusCode, 200);
    assert.equal(
      safeEdit
        .json()
        .participants.find(
          (item: { memberId: string }) => item.memberId === customerAId,
        ).paymentStatus,
      PaymentStatus.PAID,
    );

    const riskyEdit = await app.inject({
      method: 'PUT',
      url: `/bills/${billId}`,
      headers: auth(tokenFor(sousId)),
      payload: {
        restaurantId,
        baseCost: 10001,
        vat: 1002,
        shippingFee: 501,
        participants: [
          { memberId: customerAId, originCost: 5000 },
          { memberId: customerBId, originCost: 5001 },
        ],
      },
    });
    assert.equal(riskyEdit.statusCode, 409);
    assert.equal(riskyEdit.json().code, 'PAID_BILL_AMENDMENT_BLOCKED');

    const archive = await app.inject({
      method: 'PATCH',
      url: `/bills/${billId}/archive`,
      headers: auth(tokenFor(headId)),
    });
    assert.equal(archive.statusCode, 200);
    const restore = await app.inject({
      method: 'PATCH',
      url: `/bills/${billId}/restore`,
      headers: auth(tokenFor(headId)),
    });
    assert.equal(restore.statusCode, 200);
  },
);

integrationTest(
  'payment correction, audit, notification ownership, and reminder cooldown work',
  async () => {
    const corrected = await app.inject({
      method: 'PATCH',
      url: `/bills/${billId}/participants/${customerAId}/payment`,
      headers: auth(tokenFor(sousId)),
      payload: { expectedStatus: 'PAID', status: 'WAITING' },
    });
    assert.equal(corrected.statusCode, 200);
    assert.equal(corrected.json().paymentStatus, PaymentStatus.WAITING);
    assert.equal(
      await prisma.billAuditLog.count({
        where: { billId, action: 'PAYMENT_STATUS_CHANGED' },
      }),
      2,
    );

    const foreignNotification = await prisma.notification.create({
      data: { userId: customerBId, billId, message: 'Private reminder' },
    });
    const foreignRead = await app.inject({
      method: 'PATCH',
      url: `/notifications/${foreignNotification.id}/read`,
      headers: auth(tokenFor(customerAId)),
    });
    assert.equal(foreignRead.statusCode, 404);

    const firstReminder = await app.inject({
      method: 'POST',
      url: `/bills/${billId}/reminders`,
      headers: auth(tokenFor(sousId)),
    });
    assert.equal(firstReminder.statusCode, 200);
    assert.ok(firstReminder.json().sent >= 1);
    const secondReminder = await app.inject({
      method: 'POST',
      url: `/bills/${billId}/reminders`,
      headers: auth(tokenFor(sousId)),
    });
    assert.equal(secondReminder.statusCode, 200);
    assert.equal(secondReminder.json().sent, 0);
    assert.ok(secondReminder.json().skipped >= 1);
  },
);

integrationTest('validation failures use stable client contracts', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/bills',
    headers: auth(tokenFor(sousId)),
    payload: { restaurantId },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(response.json().issues));
});
