import { expect, test, type Page } from '@playwright/test';
import { ChefRole, PrismaClient, SystemRole } from '@prisma/client';
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
  await prisma.rootAdminTransferAudit.deleteMany();
  await prisma.billAuditLog.deleteMany();
  await prisma.roleAuditLog.deleteMany();
  await prisma.billParticipant.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.collection.deleteMany();
  await prisma.userFavorite.deleteMany();
  await prisma.restaurantEntry.deleteMany();
  await prisma.cuisine.deleteMany();
  await prisma.diningArea.deleteMany();
  await prisma.user.deleteMany();
  const passwordHash = await bcrypt.hash('password123', 4);
  const [head, sous, customer] = await Promise.all([
    prisma.user.create({
      data: {
        username: 'e2e-head',
        name: 'Head E2E',
        passwordHash,
        chefRole: ChefRole.HEAD_CHEF,
        systemRole: SystemRole.ROOT_ADMIN,
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
      data: {
        username: 'e2e-customer',
        name: 'Customer E2E',
        phone: '+84901234567',
        passwordHash,
      },
    }),
  ]);
  const cuisine = await prisma.cuisine.create({
    data: { name: 'Vietnamese', nameKey: 'vietnamese', type: 'Regional' },
  });
  const restaurant = await prisma.restaurantEntry.create({
    data: {
      name: 'Existing E2E Restaurant',
      address: '1 Browser Street',
      cuisineType: 'Vietnamese',
      type: 'Restaurant',
      createdById: sous.id,
      cuisines: { create: { cuisineId: cuisine.id, isPrimary: true } },
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
  await page.getByRole('button', { name: 'Enter address manually' }).click();
  await page.getByLabel('Address').fill('2 Browser Street');
  await page.getByLabel('Phone (optional)').fill('0901234567');
  await page
    .getByLabel('Banner image URL')
    .fill('https://images.example.test/e2e-banner.jpg');
  await page.getByRole('button', { name: 'Add link' }).click();
  await page
    .getByRole('textbox', { name: 'Link URL 1' })
    .fill('https://example.test/e2e-menu');
  await page.getByRole('button', { name: 'Cuisines' }).click();
  await page
    .getByRole('searchbox', { name: 'Search cuisines...' })
    .fill('Vietnamese');
  await page.getByRole('option', { name: /Vietnamese/ }).click();
  await page.keyboard.press('Escape');
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
  const restaurantProfile = await restaurantResponse.json();
  expect(restaurantProfile.phone).toBe('+84901234567');
  expect(restaurantProfile.platformLinks).toHaveLength(1);
  expect(restaurantProfile.links).toBeUndefined();
  expect(restaurantProfile.cuisines).toEqual([
    expect.objectContaining({
      isPrimary: true,
      cuisine: expect.objectContaining({ name: 'Vietnamese' }),
    }),
  ]);
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

test('server-backed directory filters survive direct links and reloads', async ({
  page,
}) => {
  await login(page, 'e2e-head');
  await page.getByRole('link', { name: 'Restaurants' }).click();
  await page
    .getByRole('searchbox', { name: 'Search restaurants without accents...' })
    .fill('existing e2e');
  await page.getByLabel('Sort restaurants').selectOption('name-desc');
  await expect(page).toHaveURL(/search=existing(?:\+|%20)e2e/);
  await expect(page).toHaveURL(/sort=name-desc/);
  await expect(page.getByText('Existing E2E Restaurant')).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('searchbox', {
      name: 'Search restaurants without accents...',
    }),
  ).toHaveValue('existing e2e');
  await expect(page.getByLabel('Sort restaurants')).toHaveValue('name-desc');

  await page.getByRole('link', { name: 'Bills' }).click();
  await page.getByLabel('Sort bills').selectOption('total-desc');
  await page.getByLabel('From').fill('2026-01-01');
  await expect(page).toHaveURL(/sort=total-desc/);
  await expect(page).toHaveURL(/from=2026-01-01/);
  await page.reload();
  await expect(page.getByLabel('Sort bills')).toHaveValue('total-desc');
  await expect(page.getByLabel('From')).toHaveValue('2026-01-01');
});

test('member discovers, manages, shares, and reviews Collection places', async ({
  page,
}) => {
  await login(page, 'e2e-customer');
  await page.getByRole('link', { name: 'Restaurants' }).click();
  await page
    .locator('article')
    .filter({ hasText: 'Existing E2E Restaurant' })
    .click();
  await expect(page).toHaveURL(/\/restaurants\/[^/?]+$/);
  const feedback = page.getByRole('region', {
    name: 'Food and service feedback',
  });
  await expect(feedback).toBeVisible();
  await page.getByRole('button', { name: 'Favorite', exact: true }).click();
  const feedbackSelects = feedback.getByRole('combobox');
  await feedbackSelects.nth(1).selectOption('8.5');
  await feedbackSelects.nth(2).selectOption('9');
  await feedback.getByLabel('Comment (optional)').fill('Reliable team lunch.');
  await feedback.getByRole('button', { name: 'Submit feedback' }).click();
  await expect(page.getByText('Feedback submitted.')).toBeVisible();

  await page.getByRole('link', { name: 'Collections' }).click();
  await expect(page.getByText('Favorites', { exact: true })).toBeVisible();
  await expect(page.getByText('Recommended', { exact: true })).toBeVisible();
  await page.getByLabel('Name').fill('E2E Team Spots');
  await page.getByLabel('Description').fill('Shared browser journey');
  const createResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/collections') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create Collection' }).click();
  expect((await createResponse).status()).toBe(201);
  await page.getByRole('button', { name: /E2E Team Spots/ }).click();

  await page.getByRole('button', { name: 'Add a place' }).click();
  await page.getByRole('option', { name: /Existing E2E Restaurant/ }).click();
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Existing E2E Restaurant')).toBeVisible();
  await page.getByRole('button', { name: 'Choose a member' }).click();
  await page.getByRole('option', { name: /Sous E2E/ }).click();
  await page.getByRole('button', { name: 'Share' }).click();
  await expect(page.getByText('Sous E2E')).toBeVisible();

  await page.evaluate(() => localStorage.removeItem('ff-token'));
  await login(page, 'e2e-sous');
  await page.getByRole('link', { name: 'Collections' }).click();
  await page.getByLabel('Visibility').selectOption('shared');
  await page.getByRole('button', { name: /E2E Team Spots/ }).click();
  await expect(page.getByText('Existing E2E Restaurant')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add' })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('Root Admin archives, restores, administers roles, and cannot alter root through chef roles', async ({
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
  for (const column of [
    'Full name',
    'Username',
    'Phone',
    'Effective role',
    'Actions',
  ]) {
    await expect(
      page.getByRole('columnheader', { name: column }),
    ).toBeVisible();
  }
  const search = page.getByRole('searchbox', {
    name: 'Search name, username, or phone',
  });
  await search.fill('+84901234567');
  await expect(
    page.getByRole('row').filter({ hasText: 'Customer E2E' }),
  ).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: 'Head E2E' }),
  ).toHaveCount(0);
  await search.clear();

  const headRow = page.getByRole('row').filter({ hasText: 'Head E2E' });
  await expect(headRow).toContainText('Root Admin');
  await expect(headRow).toContainText('Read only');
  await expect(
    headRow.getByRole('button', { name: 'Head E2E role' }),
  ).toHaveCount(0);
  const customerRow = page.getByRole('row').filter({ hasText: 'Customer E2E' });
  await customerRow.getByRole('button', { name: 'Customer E2E role' }).click();
  await page.getByRole('option', { name: 'Sous Chef' }).click();
  await expect(customerRow).toContainText('Sous Chef');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel('Member cards')).toBeVisible();
  await expect(
    page.getByLabel('Member cards').getByRole('article').filter({
      hasText: 'Customer E2E',
    }),
  ).toBeVisible();
  await expect(page.getByRole('table')).toBeHidden();

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

test('member changes password while older sessions are invalidated', async ({
  page,
}) => {
  await login(page, 'e2e-customer');
  const oldToken = await page.evaluate(() => localStorage.getItem('ff-token'));
  await page.goto('/profile');

  await page.getByLabel('Current password').fill('password123');
  await page
    .getByLabel('New password', { exact: true })
    .fill('new-password-123');
  await page.getByLabel('Confirm new password').fill('new-password-123');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(
    page.getByText('Password changed and other sessions were signed out.'),
  ).toBeVisible();

  const oldSession = await page.request.get('http://127.0.0.1:4000/me', {
    headers: { authorization: `Bearer ${oldToken}` },
  });
  expect(oldSession.status()).toBe(401);
  expect((await oldSession.json()).code).toBe('SESSION_INVALIDATED');

  await page.getByLabel('Current password').fill('new-password-123');
  await page.getByLabel('New password', { exact: true }).fill('password123');
  await page.getByLabel('Confirm new password').fill('password123');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByLabel('Current password')).toHaveValue('');
});
