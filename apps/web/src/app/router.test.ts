// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, createBrowserRouter: vi.fn(() => ({})) };
});

import { appLoader, mutationAction } from './router.js';

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
  roles: ['CUSTOMER', 'HEAD_CHEF'],
};

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
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
});
