import { redirect, type LoaderFunctionArgs } from 'react-router';
import { ApiError } from '@/api/client';
import type { Stats } from '@/api/types';
import { session } from '@/lib/session';

const statsRanges = new Set(['weekly', 'monthly', 'yearly', 'custom']);

export async function statsLoader({ request }: LoaderFunctionArgs) {
  if (!session.getToken()) throw redirect('/login');
  const url = new URL(request.url);
  const requestedRange = url.searchParams.get('range') ?? 'monthly';
  const range = statsRanges.has(requestedRange) ? requestedRange : 'monthly';
  const query = new URLSearchParams({ range });
  if (range === 'custom') {
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (from) query.set('from', from);
    if (to) query.set('to', to);
  }

  try {
    return await session.api().request<Stats>(`/stats/me?${query}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      session.clear();
      throw redirect('/login');
    }
    throw error;
  }
}
