// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, createBrowserRouter: vi.fn(() => ({})) };
});

import { matchRoutes } from 'react-router';
import {
  appLoader,
  billActivityLoader,
  loginAction,
  loginLoader,
  mutationAction,
  roleGuard,
  routes,
  statsLoader,
} from './router';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const user = {
  id: 'head-1',
  username: 'head',
  name: 'Head Chef',
  chefRole: 'HEAD_CHEF' as const,
  systemRole: 'ROOT_ADMIN' as const,
  roles: ['CUSTOMER', 'HEAD_CHEF', 'ROOT_ADMIN'],
  paymentRemindersEnabled: true,
};

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('routes', () => {
  it('renders a component while redirecting from root and unknown paths', () => {
    for (const pathname of ['/', '/unknown']) {
      const matches = matchRoutes(routes, pathname);
      expect(matches).not.toBeNull();
      expect(matches?.at(-1)?.route.Component).toBeDefined();
    }
  });

  it('provides initial hydration UI for top-level data routes', () => {
    const loginRoute = routes.find((route) => route.path === '/login');
    const appRoute = routes.find((route) => route.id === 'app');

    expect(loginRoute?.HydrateFallback).toBeDefined();
    expect(appRoute?.HydrateFallback).toBeDefined();
  });
});

describe('appLoader', () => {
  it('redirects unauthenticated users to login', async () => {
    await expect(appLoader()).rejects.toMatchObject({ status: 302 });
  });

  it('loads the authenticated application snapshot', async () => {
    localStorage.setItem('ff-token', 'token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/me')) return jsonResponse(user);
        if (url.includes('/bills')) return jsonResponse([]);
        if (url.includes('/restaurants')) return jsonResponse([]);
        if (url.endsWith('/users')) return jsonResponse([user]);
        if (url.endsWith('/admin/password-reset-requests'))
          return jsonResponse([]);
        if (url.endsWith('/notifications')) return jsonResponse([]);
        if (url.endsWith('/participant-groups')) return jsonResponse([]);
        return jsonResponse({}, 404);
      }),
    );

    const data = await appLoader();
    expect(data.user).toEqual(user);
    expect(data.users).toEqual([user]);
    expect(data.warning).toBeNull();
  });

  it('starts shared snapshot requests without waiting for the user request', async () => {
    localStorage.setItem('ff-token', 'token');
    let resolveUser!: (response: Response) => void;
    const userResponse = new Promise<Response>((resolve) => {
      resolveUser = resolve;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/me')) return userResponse;
      return jsonResponse([]);
    });
    vi.stubGlobal('fetch', fetchMock);

    const loaderPromise = appLoader();
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/bills\?/),
        expect.any(Object),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/notifications$/),
        expect.any(Object),
      );
    });

    resolveUser(jsonResponse(user));
    await loaderPromise;
  });

  it('returns a warning when a secondary request fails', async () => {
    localStorage.setItem('ff-token', 'token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/me')) return jsonResponse(user);
        if (url.includes('/bills')) return jsonResponse({}, 500);
        return jsonResponse([]);
      }),
    );

    const data = await appLoader();
    expect(data.bills).toEqual([]);
    expect(data.warning).toMatch(/Some data/);
  });
});

describe('roleGuard', () => {
  it('redirects a Head Chef away from ROOT_ADMIN-only routes', async () => {
    localStorage.setItem('ff-token', 'token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          ...user,
          systemRole: null,
          roles: ['CUSTOMER', 'HEAD_CHEF'],
        }),
      ),
    );

    await expect(
      roleGuard(
        (candidate) => candidate.systemRole === 'ROOT_ADMIN',
        {} as never,
      ),
    ).rejects.toMatchObject({ status: 302 });
  });
});

describe('statsLoader', () => {
  it('loads the selected custom date range', async () => {
    localStorage.setItem('ff-token', 'token');
    const stats = {
      totals: { paid: 100, waiting: 200, totalObligation: 300 },
      total: 300,
      byPaymentStatus: { PAID: 100, WAITING: 200 },
      byCuisineType: {},
      byEntry: {},
      byPeriod: {},
      frequencyByRestaurant: {},
      frequencyByCuisine: {},
    };
    const fetchMock = vi.fn(async () => jsonResponse(stats));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      statsLoader({
        request: new Request(
          'http://localhost/stats?range=custom&from=2026-07-01&to=2026-07-15',
        ),
        params: {},
        context: {},
      } as never),
    ).resolves.toEqual(stats);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /\/stats\/me\?range=custom&from=2026-07-01&to=2026-07-15$/,
      ),
      expect.any(Object),
    );
  });
});

describe('loginLoader', () => {
  it('warms the API while an unauthenticated user views login', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loginLoader()).resolves.toBeNull();
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/health$/),
        expect.any(Object),
      );
    });
  });
});

describe('billActivityLoader', () => {
  it('loads the scoped bill timeline', async () => {
    localStorage.setItem('ff-token', 'token');
    const activity = [
      {
        id: 'created-bill-1',
        action: 'CREATED',
        actor: { id: 'head-1', username: 'head', name: 'Head Chef' },
        createdAt: '2026-07-15T01:00:00.000Z',
      },
    ];
    const fetchMock = vi.fn(async () => jsonResponse(activity));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      billActivityLoader({
        request: new Request('http://localhost/bills/bill-1'),
        params: { billId: 'bill-1' },
        context: {},
      } as never),
    ).resolves.toEqual(activity);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/bills\/bill-1\/activity$/),
      expect.any(Object),
    );
  });
});

describe('loginAction', () => {
  it('submits an opaque password reset request without creating a session', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }, 202));
    vi.stubGlobal('fetch', fetchMock);
    const request = new Request('http://localhost/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'forgot-request',
        identifier: 'member-one',
      }),
    });

    await expect(
      loginAction({ request, params: {}, context: {} } as never),
    ).resolves.toEqual({ success: true, intent: 'forgot-request' });
    expect(localStorage.getItem('ff-token')).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/password-reset-requests$/),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns invalid credentials as handled action data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
          401,
        ),
      ),
    );
    const request = new Request('http://localhost/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'login',
        identifier: 'missing',
        password: 'wrong-password',
      }),
    });

    const result = await loginAction({
      request,
      params: {},
      context: {},
    } as never);

    expect(result).toMatchObject({
      data: {
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
        intent: 'login',
      },
      init: { status: 401 },
    });
    expect(localStorage.getItem('ff-token')).toBeNull();
  });

  it('returns an invalid invite code as handled action data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            code: 'REGISTRATION_NOT_AUTHORIZED',
            message: 'Registration is not authorized',
          },
          403,
        ),
      ),
    );
    const request = new Request('http://localhost/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'register',
        name: 'New Member',
        username: 'new-member',
        phone: '',
        password: 'password123',
        inviteCode: 'invalid',
      }),
    });

    const result = await loginAction({
      request,
      params: {},
      context: {},
    } as never);

    expect(result).toMatchObject({
      data: {
        error: 'Registration is not authorized',
        code: 'REGISTRATION_NOT_AUTHORIZED',
        intent: 'register',
      },
      init: { status: 403 },
    });
    expect(localStorage.getItem('ff-token')).toBeNull();
  });
});

describe('mutationAction', () => {
  it('submits the enriched restaurant profile contract for editing', async () => {
    localStorage.setItem('ff-token', 'token');
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const payload = {
      phone: '0901234567',
      bannerImageUrl: 'https://image.test/banner.jpg',
      platformLinks: [
        { platform: 'WEBSITE', url: 'https://example.test/menu' },
      ],
    };
    const request = new Request('http://localhost/restaurants/restaurant-1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'update-restaurant', payload }),
    });

    await mutationAction({
      request,
      params: { restaurantId: 'restaurant-1' },
      context: {},
    } as never);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/restaurants\/restaurant-1$/),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(payload) }),
    );
  });

  it('dispatches a bill status intent to the API', async () => {
    localStorage.setItem('ff-token', 'token');
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const request = new Request('http://localhost/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'bill-status',
        billId: 'bill-1',
        status: 'archive',
      }),
    });

    await mutationAction({ request, params: {}, context: {} } as never);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/bills\/bill-1\/archive$/),
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('returns handled API failures for mutation toasts', async () => {
    localStorage.setItem('ff-token', 'token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          { code: 'PAYMENT_STATUS_CONFLICT', message: 'Status changed' },
          409,
        ),
      ),
    );
    const request = new Request('http://localhost/bills/bill-1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'payment',
        memberId: 'member-1',
        status: 'PAID',
        expectedStatus: 'WAITING',
      }),
    });

    const result = await mutationAction({
      request,
      params: { billId: 'bill-1' },
      context: {},
    } as never);

    expect(result).toMatchObject({
      data: { error: 'Status changed', code: 'PAYMENT_STATUS_CONFLICT' },
      init: { status: 409 },
    });
  });

  it('clears the current session after a successful root transfer', async () => {
    localStorage.setItem('ff-token', 'token');
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const request = new Request('http://localhost/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'root-transfer',
        payload: {
          currentPassword: 'password123',
          targetUsername: 'member-one',
          confirmationUsername: 'member-one',
        },
      }),
    });

    await expect(
      mutationAction({ request, params: {}, context: {} } as never),
    ).resolves.toMatchObject({ status: 302 });
    expect(localStorage.getItem('ff-token')).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/admin\/root-transfer$/),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('replaces the current token after a successful password change', async () => {
    localStorage.setItem('ff-token', 'old-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ token: 'fresh-token' })),
    );
    const request = new Request('http://localhost/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'change-password',
        payload: {
          currentPassword: 'password123',
          newPassword: 'new-password-123',
          confirmation: 'new-password-123',
        },
      }),
    });

    await mutationAction({ request, params: {}, context: {} } as never);
    expect(localStorage.getItem('ff-token')).toBe('fresh-token');
  });
});
