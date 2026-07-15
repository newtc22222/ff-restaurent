// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../app/providers/i18n';
import StatsPage from './StatsPage';

const { searchParams, setSearchParams } = vi.hoisted(() => ({
  searchParams: new URLSearchParams(
    'range=custom&from=2026-07-01&to=2026-07-15',
  ),
  setSearchParams: vi.fn(),
}));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useLoaderData: () => ({
      totals: { paid: 100_000, waiting: 50_000, totalObligation: 150_000 },
      total: 150_000,
      byPaymentStatus: { PAID: 100_000, WAITING: 50_000 },
      byCuisineType: {},
      byEntry: {},
      byPeriod: {},
      frequencyByRestaurant: {},
      frequencyByCuisine: {},
    }),
    useSearchParams: () => [searchParams, setSearchParams],
  };
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('ff-locale', 'en');
  setSearchParams.mockClear();
});

afterEach(cleanup);

describe('StatsPage ranges and obligations', () => {
  it('shows paid, waiting, total obligations and applies valid custom dates', () => {
    render(
      <I18nProvider>
        <StatsPage />
      </I18nProvider>,
    );

    expect(screen.getAllByText('Paid').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Waiting').length).toBeGreaterThan(0);
    expect(screen.getByText('Total obligation')).toBeTruthy();

    const [from, to] = screen.getAllByDisplayValue(/2026-07-/);
    fireEvent.change(from, { target: { value: '2026-07-02' } });
    fireEvent.change(to, { target: { value: '2026-07-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(setSearchParams).toHaveBeenCalledWith({
      range: 'custom',
      from: '2026-07-02',
      to: '2026-07-20',
    });
  });

  it('keeps an inverted custom range inline and blocks applying it', () => {
    render(
      <I18nProvider>
        <StatsPage />
      </I18nProvider>,
    );

    const [from, to] = screen.getAllByDisplayValue(/2026-07-/);
    fireEvent.change(from, { target: { value: '2026-07-21' } });
    fireEvent.change(to, { target: { value: '2026-07-20' } });

    expect(
      screen.getByText('The end date must be on or after the start date.'),
    ).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
