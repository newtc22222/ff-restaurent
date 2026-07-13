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
  await page.getByRole('button', { name: 'Customer E2E, Customer' }).click();
  await expect(page.getByRole('menuitem', { name: 'Profile' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Profile' }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await page.goBack();
  await page.getByLabel('Notifications').click();
  await page.getByText('E2E payment reminder').click();
  await expect(
    page.getByRole('link', { name: /Open secure payment link/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Mark paid' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  const paidButton = page.getByRole('button', { name: 'Correct' });
  await expect(paidButton).toBeVisible();
  await expect(paidButton).toBeEnabled();

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
  await page.getByRole('link', { name: 'Restaurants' }).click();
  await page.getByLabel('Name').fill('Created E2E Restaurant');
  await page.getByLabel('Address').fill('2 Browser Street');
  await page.getByRole('button', { name: 'Cuisine type' }).click();
  await page
    .getByRole('searchbox', { name: 'Search cuisines...' })
    .fill('Chay');
  await page.getByRole('option', { name: 'Chay' }).click();
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

  await page.getByRole('link', { name: 'Bills' }).click();
  await page.getByRole('button', { name: 'Create bill' }).click();
  await expect(page).toHaveURL(/\/bills\/new$/);
  await page.getByRole('button', { name: 'Restaurant / Eatery' }).click();
  await page
    .getByRole('searchbox', { name: 'Search restaurants or eateries…' })
    .fill('Created E2E Restaurant');
  await page
    .getByRole('option')
    .filter({ hasText: 'Created E2E Restaurant' })
    .click();
  const memberSearch = page.getByPlaceholder(
    'Search by full name or username…',
  );
  await page.getByRole('button', { name: 'Add participant' }).click();
  await memberSearch.fill('Customer E2E');
  await page.getByRole('option').filter({ hasText: 'Customer E2E' }).click();
  await memberSearch.fill('Sous E2E');
  await page.getByRole('option').filter({ hasText: 'Sous E2E' }).click();
  await memberSearch.press('Escape');
  await page.getByLabel('Base amount for Customer E2E').fill('50000');
  await page.getByLabel('Base amount for Sous E2E').fill('50000');
  await expect(page.getByText(/Reconciled:/)).toBeVisible();
  await page.getByRole('button', { name: 'Save bill' }).click();
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
  await page.getByRole('link', { name: 'Members' }).click();
  const headRow = page.getByRole('article').filter({ hasText: 'Head E2E' });
  await expect(
    headRow.getByRole('button', { name: 'Head E2E role' }),
  ).toHaveCount(0);
  const customerRow = page
    .getByRole('article')
    .filter({ hasText: 'Customer E2E' });
  await customerRow.getByRole('button', { name: 'Customer E2E role' }).click();
  await customerRow.getByRole('option', { name: 'Sous chef' }).click();
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

  const header = page.getByRole('banner');
  const brand = header.getByTestId('app-brand');
  await expect(brand).toBeVisible();
  const [headerBox, brandBox] = await Promise.all([
    header.boundingBox(),
    brand.boundingBox(),
  ]);
  expect(headerBox).not.toBeNull();
  expect(brandBox).not.toBeNull();
  expect(
    Math.abs(
      brandBox!.x + brandBox!.width / 2 - (headerBox!.x + headerBox!.width / 2),
    ),
  ).toBeLessThan(2);

  await page.getByRole('button', { name: 'Options' }).click();
  await expect(
    page.getByRole('button', { name: 'Notifications' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Expand navigation' }).click();
  const restaurantsLink = page.getByRole('link', { name: 'Restaurants' });
  await expect(restaurantsLink).toBeVisible();
  await expect(restaurantsLink.locator('span')).not.toHaveClass(/sr-only/);
  await expect(page.locator('main')).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
