import { expect, test, type Page } from '@playwright/test';
import { ChefRole, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const login = async (page: Page, username: string) => {
  await page.addInitScript(() => localStorage.setItem('ff-locale', 'en'));
  await page.goto('/');
  await page.getByLabel('Phone / Username').fill(username);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Bills', exact: true }),
  ).toBeVisible();
};

test.beforeAll(async () => {
  await prisma.notification.deleteMany();
  await prisma.billAuditLog.deleteMany();
  await prisma.roleAuditLog.deleteMany();
  await prisma.billParticipant.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.userFavorite.deleteMany();
  await prisma.restaurantEntry.deleteMany();
  await prisma.user.deleteMany();
  const passwordHash = await bcrypt.hash('password123', 4);
  const [head, sous, customer] = await Promise.all([
    prisma.user.create({
      data: {
        username: 'e2e-head',
        name: 'Head E2E',
        passwordHash,
        chefRole: ChefRole.HEAD_CHEF,
      },
    }),
    prisma.user.create({
      data: {
        username: 'e2e-sous',
        name: 'Sous E2E',
        passwordHash,
        chefRole: ChefRole.SOUS_CHEF,
      },
    }),
    prisma.user.create({
      data: { username: 'e2e-customer', name: 'Customer E2E', passwordHash },
    }),
  ]);
  const restaurant = await prisma.restaurantEntry.create({
    data: {
      name: 'Existing E2E Restaurant',
      address: '1 Browser Street',
      cuisineType: 'Vietnamese',
      type: 'Restaurant',
      createdById: sous.id,
    },
  });
  const bill = await prisma.bill.create({
    data: {
      restaurantId: restaurant.id,
      createdById: sous.id,
      baseCost: 10000,
      vat: 1000,
      shippingFee: 0,
      totalCost: 11000,
      paymentUrl: 'https://example.com/pay/e2e',
      participants: {
        create: [
          {
            memberId: customer.id,
            originCost: 5000,
            allocatedVat: 500,
            allocatedShipping: 0,
            discountApplied: 0,
            finalPrice: 5500,
          },
          {
            memberId: sous.id,
            originCost: 5000,
            allocatedVat: 500,
            allocatedShipping: 0,
            discountApplied: 0,
            finalPrice: 5500,
          },
        ],
      },
    },
  });
  await prisma.notification.create({
    data: {
      userId: customer.id,
      billId: bill.id,
      message: 'E2E payment reminder',
    },
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('Customer views notifications, pays, corrects, and is denied chef actions', async ({
  page,
}) => {
  await login(page, 'e2e-customer');
  await page.getByLabel('Notifications').click();
  await page.getByText('E2E payment reminder').click();
  await expect(
    page.getByRole('link', { name: /Open secure payment link/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Mark paid' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(
    page.getByRole('button', { name: 'Correct to waiting' }),
  ).toBeVisible();

  const token = await page.evaluate(() => localStorage.getItem('ff-token'));
  const denied = await page.request.post('http://127.0.0.1:4000/bills', {
    headers: { authorization: `Bearer ${token}` },
    data: {},
  });
  expect(denied.status()).toBe(403);
});

test('Sous Chef creates a restaurant and reconciled bill and is denied admin', async ({
  page,
}) => {
  await login(page, 'e2e-sous');
  await page.getByRole('button', { name: 'Restaurants' }).click();
  await page.getByLabel('Name').fill('Created E2E Restaurant');
  await page.getByLabel('Address').fill('2 Browser Street');
  await page.getByLabel('Cuisine type').selectOption('Chay');
  const restaurantResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/restaurants') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create entry' }).click();
  const restaurantResponse = await restaurantResponsePromise;
  expect(restaurantResponse.status(), await restaurantResponse.text()).toBe(
    201,
  );
  await expect(page.getByText('Created E2E Restaurant')).toBeVisible();

  await page.getByRole('button', { name: 'Bills' }).click();
  await page.getByRole('button', { name: 'Create bill' }).click();
  await page.getByLabel('Restaurant / Eatery').selectOption({
    label: 'Created E2E Restaurant',
  });
  await page.getByRole('button', { name: 'Customer', exact: true }).click();
  await page.getByRole('button', { name: 'Sous', exact: true }).click();
  await page.getByLabel('Base amount for Customer E2E').fill('50000');
  await page.getByLabel('Base amount for Sous E2E').fill('50000');
  await expect(page.getByText(/Reconciled:/)).toBeVisible();
  await page.getByRole('button', { name: 'Create bill' }).click();
  await expect(page.getByText('Created E2E Restaurant')).toBeVisible();

  const token = await page.evaluate(() => localStorage.getItem('ff-token'));
  const denied = await page.request.get('http://127.0.0.1:4000/users', {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(denied.status()).toBe(403);
});

test('Head Chef archives, restores, administers roles, and cannot self-demote', async ({
  page,
}) => {
  await login(page, 'e2e-head');
  await page.getByRole('button', { name: 'View detail' }).first().click();
  await page.getByRole('button', { name: 'Archive bill' }).click();
  const archiveResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/archive') &&
      response.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Confirm' }).click();
  const archiveResponse = await archiveResponsePromise;
  expect(archiveResponse.status(), await archiveResponse.text()).toBe(200);
  await expect(
    page.getByRole('button', { name: 'Restore bill' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back to Bills' }).click();
  await page.getByRole('button', { name: 'Members' }).click();
  const customerRow = page
    .getByRole('article')
    .filter({ hasText: 'Customer E2E' });
  await customerRow.locator('select').selectOption('SOUS_CHEF');
  await expect(customerRow).toContainText('Sous chef');

  const token = await page.evaluate(() => localStorage.getItem('ff-token'));
  const head = await prisma.user.findUniqueOrThrow({
    where: { username: 'e2e-head' },
  });
  const denied = await page.request.patch(
    `http://127.0.0.1:4000/users/${head.id}/chef-role`,
    {
      headers: { authorization: `Bearer ${token}` },
      data: { chefRole: null },
    },
  );
  expect(denied.status()).toBe(403);
});

test('mobile app shell and bill list fit without page overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'e2e-customer');
  await expect(page.getByRole('button', { name: 'Restaurants' })).toBeVisible();
  await expect(page.getByLabel('Notifications')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
