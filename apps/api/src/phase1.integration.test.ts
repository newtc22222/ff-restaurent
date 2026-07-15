import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ChefRole, PaymentStatus, SystemRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { prisma } from './prisma.js';
import {
  RootAdminTransferError,
  transferRootAdmin,
} from './root-admin-service.js';

const integrationTest =
  process.env.RUN_INTEGRATION_TESTS === '1' ? test : test.skip;

let app: FastifyInstance;
let headId: string;
let rootId: string;
let sousId: string;
let customerAId: string;
let customerBId: string;
let restaurantId: string;
let billId: string;

const tokenFor = (id: string, expiresIn = '8h', version?: number) =>
  app.jwt.sign(
    { sub: id, ...(version === undefined ? {} : { ver: version }) },
    { expiresIn },
  );
const auth = (token: string) => ({ authorization: `Bearer ${token}` });

before(async () => {
  if (process.env.RUN_INTEGRATION_TESTS !== '1') return;
  process.env.JWT_SECRET ??=
    'integration-secret-that-is-at-least-32-characters';
  process.env.REGISTRATION_INVITE_CODE ??= 'integration-invite';
  app = await buildApp();
  await prisma.passwordResetRequest.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.billAuditLog.deleteMany();
  await prisma.rootAdminTransferAudit.deleteMany();
  await prisma.roleAuditLog.deleteMany();
  await prisma.billParticipant.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.userFavorite.deleteMany();
  await prisma.restaurantEntry.deleteMany();
  await prisma.user.deleteMany();
  const passwordHash = await bcrypt.hash('password123', 4);
  const [root, head, sous, customerA, customerB] = await Promise.all([
    prisma.user.create({
      data: {
        username: 'root-int',
        name: 'Root Admin',
        passwordHash,
        systemRole: SystemRole.ROOT_ADMIN,
      },
    }),
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
  rootId = root.id;
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

integrationTest('ROOT_ADMIN exclusively governs chef roles', async () => {
  const denied = await app.inject({
    method: 'GET',
    url: '/users',
    headers: auth(tokenFor(customerAId)),
  });
  assert.equal(denied.statusCode, 403);

  const headList = await app.inject({
    method: 'GET',
    url: '/users',
    headers: auth(tokenFor(headId)),
  });
  assert.equal(headList.statusCode, 403);
  assert.equal(headList.json().code, 'ROOT_ADMIN_REQUIRED');

  for (const targetId of [customerAId, sousId, headId, rootId]) {
    const headChange = await app.inject({
      method: 'PATCH',
      url: `/users/${targetId}/chef-role`,
      headers: auth(tokenFor(headId)),
      payload: { chefRole: ChefRole.SOUS_CHEF },
    });
    assert.equal(headChange.statusCode, 403);
    assert.equal(headChange.json().code, 'ROOT_ADMIN_REQUIRED');
  }

  const rootList = await app.inject({
    method: 'GET',
    url: '/users',
    headers: auth(tokenFor(rootId)),
  });
  assert.equal(rootList.statusCode, 200);
  assert.equal(JSON.stringify(rootList.json()).includes('passwordHash'), false);
  assert.equal(
    JSON.stringify(rootList.json()).includes('sessionVersion'),
    false,
  );

  const rootTarget = await app.inject({
    method: 'PATCH',
    url: `/users/${rootId}/chef-role`,
    headers: auth(tokenFor(rootId)),
    payload: { chefRole: ChefRole.HEAD_CHEF },
  });
  assert.equal(rootTarget.statusCode, 403);
  assert.equal(rootTarget.json().code, 'ROOT_ADMIN_ROLE_CHANGE_FORBIDDEN');

  const promoted = await app.inject({
    method: 'PATCH',
    url: `/users/${customerAId}/chef-role`,
    headers: auth(tokenFor(rootId)),
    payload: { chefRole: ChefRole.SOUS_CHEF },
  });
  assert.equal(promoted.statusCode, 200);
  assert.equal(promoted.json().chefRole, ChefRole.SOUS_CHEF);
  const restored = await app.inject({
    method: 'PATCH',
    url: `/users/${customerAId}/chef-role`,
    headers: auth(tokenFor(rootId)),
    payload: { chefRole: null },
  });
  assert.equal(restored.statusCode, 200);
});

integrationTest('the database permits exactly one ROOT_ADMIN', async () => {
  await assert.rejects(
    prisma.user.create({
      data: {
        username: 'second-root-int',
        name: 'Second Root',
        passwordHash: await bcrypt.hash('password123', 4),
        systemRole: SystemRole.ROOT_ADMIN,
      },
    }),
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002',
  );
  assert.equal(
    await prisma.user.count({
      where: { systemRole: SystemRole.ROOT_ADMIN },
    }),
    1,
  );
});

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

integrationTest(
  'password change keeps one fresh session and invalidates every older token',
  async () => {
    const legacyToken = tokenFor(customerBId);
    const legacyBeforeChange = await app.inject({
      method: 'GET',
      url: '/me',
      headers: auth(legacyToken),
    });
    assert.equal(legacyBeforeChange.statusCode, 200);

    const firstLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { identifier: 'customer-b-int', password: 'password123' },
    });
    const secondLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { identifier: 'customer-b-int', password: 'password123' },
    });
    assert.equal(firstLogin.statusCode, 200);
    assert.equal(secondLogin.statusCode, 200);

    const cases = [
      {
        payload: {
          currentPassword: 'password123',
          newPassword: 'short',
          confirmation: 'short',
        },
        status: 400,
        code: 'PASSWORD_LENGTH_INVALID',
      },
      {
        payload: {
          currentPassword: 'password123',
          newPassword: 'new-password-123',
          confirmation: 'different-password',
        },
        status: 400,
        code: 'PASSWORD_CONFIRMATION_MISMATCH',
      },
      {
        payload: {
          currentPassword: 'wrong-password',
          newPassword: 'new-password-123',
          confirmation: 'new-password-123',
        },
        status: 403,
        code: 'CURRENT_PASSWORD_INVALID',
      },
      {
        payload: {
          currentPassword: 'password123',
          newPassword: 'password123',
          confirmation: 'password123',
        },
        status: 409,
        code: 'PASSWORD_REUSE_FORBIDDEN',
      },
    ];
    for (const item of cases) {
      const response = await app.inject({
        method: 'PATCH',
        url: '/me/password',
        headers: auth(firstLogin.json().token),
        payload: item.payload,
      });
      assert.equal(response.statusCode, item.status);
      assert.equal(response.json().code, item.code);
    }

    const changed = await app.inject({
      method: 'PATCH',
      url: '/me/password',
      headers: auth(firstLogin.json().token),
      payload: {
        currentPassword: 'password123',
        newPassword: 'new-password-123',
        confirmation: 'new-password-123',
      },
    });
    assert.equal(changed.statusCode, 200);
    assert.equal(typeof changed.json().token, 'string');
    assert.equal(
      JSON.stringify(changed.json()).includes('passwordHash'),
      false,
    );

    for (const oldToken of [legacyToken, secondLogin.json().token]) {
      const invalidated = await app.inject({
        method: 'GET',
        url: '/me',
        headers: auth(oldToken),
      });
      assert.equal(invalidated.statusCode, 401);
      assert.equal(invalidated.json().code, 'SESSION_INVALIDATED');
    }
    const currentSession = await app.inject({
      method: 'GET',
      url: '/me',
      headers: auth(changed.json().token),
    });
    assert.equal(currentSession.statusCode, 200);

    const oldPasswordLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { identifier: 'customer-b-int', password: 'password123' },
    });
    assert.equal(oldPasswordLogin.statusCode, 401);
    const newPasswordLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        identifier: 'customer-b-int',
        password: 'new-password-123',
      },
    });
    assert.equal(newPasswordLogin.statusCode, 200);

    const restored = await app.inject({
      method: 'PATCH',
      url: '/me/password',
      headers: auth(newPasswordLogin.json().token),
      payload: {
        currentPassword: 'new-password-123',
        newPassword: 'password123',
        confirmation: 'password123',
      },
    });
    assert.equal(restored.statusCode, 200);
  },
);

integrationTest(
  'password recovery is opaque, root-assisted, hashed, single-use, and invalidates sessions',
  async () => {
    const missing = await app.inject({
      method: 'POST',
      url: '/auth/password-reset-requests',
      payload: { identifier: 'missing-account-int' },
    });
    const requested = await app.inject({
      method: 'POST',
      url: '/auth/password-reset-requests',
      payload: { identifier: 'customer-a-int' },
    });
    assert.equal(missing.statusCode, 202);
    assert.deepEqual(missing.json(), requested.json());

    const list = await app.inject({
      method: 'GET',
      url: '/admin/password-reset-requests',
      headers: auth(tokenFor(rootId)),
    });
    assert.equal(list.statusCode, 200);
    const listed = list
      .json()
      .find((item: { user: { id: string } }) => item.user.id === customerAId);
    assert.ok(listed);
    assert.equal('codeHash' in listed, false);

    const issued = await app.inject({
      method: 'POST',
      url: `/admin/password-reset-requests/${listed.id}/issue`,
      headers: auth(tokenFor(rootId)),
    });
    assert.equal(issued.statusCode, 200);
    assert.match(issued.json().code, /^[2-9A-HJ-NP-Z]{8}$/);
    const stored = await prisma.passwordResetRequest.findUniqueOrThrow({
      where: { id: listed.id },
    });
    assert.notEqual(stored.codeHash, issued.json().code);
    assert.ok(await bcrypt.compare(issued.json().code, stored.codeHash!));

    const oldSession = tokenFor(customerAId);
    const consumed = await app.inject({
      method: 'POST',
      url: '/auth/password-reset',
      payload: {
        identifier: 'customer-a-int',
        code: issued.json().code,
        newPassword: 'recovered-password-123',
        confirmation: 'recovered-password-123',
      },
    });
    assert.equal(consumed.statusCode, 200);
    const replay = await app.inject({
      method: 'POST',
      url: '/auth/password-reset',
      payload: {
        identifier: 'customer-a-int',
        code: issued.json().code,
        newPassword: 'another-password-123',
        confirmation: 'another-password-123',
      },
    });
    assert.equal(replay.statusCode, 400);
    assert.equal(replay.json().code, 'PASSWORD_RESET_INVALID');
    const invalidated = await app.inject({
      method: 'GET',
      url: '/me',
      headers: auth(oldSession),
    });
    assert.equal(invalidated.statusCode, 401);
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        identifier: 'customer-a-int',
        password: 'recovered-password-123',
      },
    });
    assert.equal(login.statusCode, 200);

    await app.inject({
      method: 'POST',
      url: '/auth/password-reset-requests',
      payload: { identifier: 'root-int' },
    });
    const rootRequest = await prisma.passwordResetRequest.findFirstOrThrow({
      where: { userId: rootId, activeKey: rootId },
    });
    const ownApproval = await app.inject({
      method: 'POST',
      url: `/admin/password-reset-requests/${rootRequest.id}/issue`,
      headers: auth(tokenFor(rootId)),
    });
    assert.equal(ownApproval.statusCode, 403);
    assert.equal(ownApproval.json().code, 'ROOT_RESET_REQUIRES_OPERATOR');

    await app.inject({
      method: 'POST',
      url: '/auth/password-reset-requests',
      payload: { identifier: 'customer-b-int' },
    });
    let limitedRequest = await prisma.passwordResetRequest.findFirstOrThrow({
      where: { userId: customerBId, activeKey: customerBId },
    });
    const limitedIssue = await app.inject({
      method: 'POST',
      url: `/admin/password-reset-requests/${limitedRequest.id}/issue`,
      headers: auth(tokenFor(rootId)),
    });
    assert.equal(limitedIssue.statusCode, 200);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failure = await app.inject({
        method: 'POST',
        url: '/auth/password-reset',
        payload: {
          identifier: 'customer-b-int',
          code: 'AAAAAAAA',
          newPassword: 'unused-password-123',
          confirmation: 'unused-password-123',
        },
      });
      assert.equal(failure.statusCode, 400);
    }
    limitedRequest = await prisma.passwordResetRequest.findUniqueOrThrow({
      where: { id: limitedRequest.id },
    });
    assert.equal(limitedRequest.status, 'LOCKED');
    const lockedCode = await app.inject({
      method: 'POST',
      url: '/auth/password-reset',
      payload: {
        identifier: 'customer-b-int',
        code: limitedIssue.json().code,
        newPassword: 'unused-password-123',
        confirmation: 'unused-password-123',
      },
    });
    assert.equal(lockedCode.statusCode, 400);

    await app.inject({
      method: 'POST',
      url: '/auth/password-reset-requests',
      payload: { identifier: 'customer-b-int' },
    });
    const expiringRequest = await prisma.passwordResetRequest.findFirstOrThrow({
      where: { userId: customerBId, activeKey: customerBId },
    });
    const expiringIssue = await app.inject({
      method: 'POST',
      url: `/admin/password-reset-requests/${expiringRequest.id}/issue`,
      headers: auth(tokenFor(rootId)),
    });
    await prisma.passwordResetRequest.update({
      where: { id: expiringRequest.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const expired = await app.inject({
      method: 'POST',
      url: '/auth/password-reset',
      payload: {
        identifier: 'customer-b-int',
        code: expiringIssue.json().code,
        newPassword: 'unused-password-123',
        confirmation: 'unused-password-123',
      },
    });
    assert.equal(expired.statusCode, 400);
    assert.equal(
      (
        await prisma.passwordResetRequest.findUniqueOrThrow({
          where: { id: expiringRequest.id },
        })
      ).status,
      'EXPIRED',
    );
  },
);

integrationTest(
  'root transfer is audited, conflict-safe, and invalidates both sessions',
  async () => {
    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/admin/root-transfer',
      headers: auth(tokenFor(rootId)),
      payload: {
        currentPassword: 'wrong-password',
        targetUsername: 'customer-a-int',
        confirmationUsername: 'customer-a-int',
      },
    });
    assert.equal(wrongPassword.statusCode, 403);
    assert.equal(wrongPassword.json().code, 'ROOT_TRANSFER_PASSWORD_INVALID');

    const results = await Promise.allSettled([
      transferRootAdmin({
        currentUserId: rootId,
        currentPassword: 'password123',
        targetUsername: 'customer-a-int',
        confirmationUsername: 'customer-a-int',
      }),
      transferRootAdmin({
        currentUserId: rootId,
        currentPassword: 'password123',
        targetUsername: 'customer-b-int',
        confirmationUsername: 'customer-b-int',
      }),
    ]);
    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    const rejected = results.find((result) => result.status === 'rejected');
    assert.ok(rejected && rejected.status === 'rejected');
    assert.ok(rejected.reason instanceof RootAdminTransferError);
    assert.equal(rejected.reason.code, 'ROOT_TRANSFER_CONFLICT');

    const newRoot = await prisma.user.findFirstOrThrow({
      where: { systemRole: SystemRole.ROOT_ADMIN },
    });
    assert.ok([customerAId, customerBId].includes(newRoot.id));
    assert.equal(await prisma.rootAdminTransferAudit.count(), 1);

    const oldRootSession = await app.inject({
      method: 'GET',
      url: '/me',
      headers: auth(tokenFor(rootId)),
    });
    assert.equal(oldRootSession.statusCode, 401);
    assert.equal(oldRootSession.json().code, 'SESSION_INVALIDATED');
    const newRootOldSession = await app.inject({
      method: 'GET',
      url: '/me',
      headers: auth(tokenFor(newRoot.id)),
    });
    assert.equal(newRootOldSession.statusCode, 401);

    const freshNewRootToken = tokenFor(
      newRoot.id,
      '8h',
      newRoot.sessionVersion,
    );
    const transferBack = await app.inject({
      method: 'POST',
      url: '/admin/root-transfer',
      headers: auth(freshNewRootToken),
      payload: {
        currentPassword: 'password123',
        targetUsername: 'root-int',
        confirmationUsername: 'root-int',
      },
    });
    assert.equal(transferBack.statusCode, 200);
    assert.equal(await prisma.rootAdminTransferAudit.count(), 2);
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: rootId } }))
        .systemRole,
      SystemRole.ROOT_ADMIN,
    );
  },
);
