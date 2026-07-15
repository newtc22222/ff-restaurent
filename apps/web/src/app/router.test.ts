// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, createBrowserRouter: vi.fn(() => ({})) };
});

import { matchRoutes } from 'react-router';
import {
  appLoader,
  loginAction,
  loginLoader,
  mutationAction,
  roleGuard,
  routes,
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
        if (url.includes('/stats/me')) return jsonResponse({ total: 0 });
        if (url.endsWith('/users')) return jsonResponse([user]);
        if (url.endsWith('/notifications')) return jsonResponse([]);
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
      if (url.includes('/stats/me')) return jsonResponse({ total: 0 });
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

describe('loginAction', () => {
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
});
