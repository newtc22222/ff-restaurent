// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/app/providers/i18n';

import StatsPage from './StatsPage';

const defaultStats = {
  totals: {
    paid: 100_000,
    sponsoredForMe: 0,
    sponsoredByMe: 0,
    waiting: 50_000,
    totalObligation: 150_000,
  },
  total: 150_000,
  byPaymentStatus: { PAID: 100_000, WAITING: 50_000 },
  byCuisineType: {
    'A deliberately long cuisine category that must stay contained': 50_000,
  },
  byEntry: {
    'A deliberately long restaurant name that must truncate before its value': 150_000,
  },
  byPeriod: {},
  frequencyByRestaurant: {
    'A deliberately long restaurant frequency label that must truncate': 7,
  },
  frequencyByCuisine: {
    'A deliberately long cuisine frequency label that must truncate': 5,
  },
};

const { searchParams, setSearchParams, statsData } = vi.hoisted(() => ({
  searchParams: new URLSearchParams(
    'range=custom&from=2026-07-01&to=2026-07-15',
  ),
  setSearchParams: vi.fn(),
  statsData: { current: null as unknown },
}));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useLoaderData: () => statsData.current,
    useSearchParams: () => [searchParams, setSearchParams],
  };
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('ff-locale', 'en');
  setSearchParams.mockClear();
  statsData.current = defaultStats;
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

    const pickDay = (name: RegExp) => {
      const day = screen
        .getAllByRole('button', { name })
        .find((btn) => !btn.hasAttribute('disabled'));
      if (day) fireEvent.click(day);
    };

    const fromBtn = screen.getByRole('button', { name: /Jul 1, 2026/i });
    const toBtn = screen.getByRole('button', { name: /Jul 15, 2026/i });

    fireEvent.click(fromBtn);
    pickDay(/July 2.*2026/i);

    fireEvent.click(toBtn);
    pickDay(/July 20.*2026/i);

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

    const pickDay = (name: RegExp) => {
      const day = screen
        .getAllByRole('button', { name })
        .find((btn) => !btn.hasAttribute('disabled'));
      if (day) fireEvent.click(day);
    };

    const fromBtn = screen.getByRole('button', { name: /Jul 1, 2026/i });
    const toBtn = screen.getByRole('button', { name: /Jul 15, 2026/i });

    fireEvent.click(fromBtn);
    pickDay(/July 21.*2026/i);

    fireEvent.click(toBtn);
    pickDay(/July 20.*2026/i);

    expect(
      screen.getByText('The end date must be on or after the start date.'),
    ).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('contains long category and frequency labels before fixed values', () => {
    render(
      <I18nProvider>
        <StatsPage />
      </I18nProvider>,
    );

    const apply = screen.getByRole('button', { name: 'Apply' });
    expect(apply.className).toContain('w-full');
    expect(apply.className).toContain('sm:w-auto');

    for (const row of [
      screen.getByTestId('restaurant-frequency-row'),
      screen.getByTestId('cuisine-frequency-row'),
    ]) {
      expect(row.className).toContain('min-w-0');
      expect(row.firstElementChild?.className).toContain('flex-1');
      expect(row.firstElementChild?.className).toContain('truncate');
      expect(row.lastElementChild?.className).toContain('shrink-0');
    }

    const spendLabel = screen.getByText(
      'A deliberately long restaurant name that must truncate before its value',
    );
    expect(spendLabel.className).toContain('flex-1');
    expect(spendLabel.className).toContain('truncate');
    expect(spendLabel.nextElementSibling?.className).toContain('ticket-figure');
  });
});

describe('StatsPage sponsorship totals', () => {
  it('hides sponsorship cards when nothing was sponsored', () => {
    render(
      <I18nProvider>
        <StatsPage />
      </I18nProvider>,
    );

    expect(screen.queryByText('Sponsored for me')).toBeNull();
    expect(screen.queryByText('Sponsored by me')).toBeNull();
  });

  it('shows sponsorship cards and folds sponsored shares into payment status', () => {
    statsData.current = {
      ...defaultStats,
      totals: {
        paid: 100_000,
        sponsoredForMe: 30_000,
        sponsoredByMe: 45_000,
        waiting: 50_000,
        totalObligation: 180_000,
      },
    };

    render(
      <I18nProvider>
        <StatsPage />
      </I18nProvider>,
    );

    expect(screen.getAllByText('Sponsored for me').length).toBeGreaterThan(0);
    expect(screen.getByText('Sponsored by me')).toBeTruthy();
    expect(screen.getByText('Total obligation')).toBeTruthy();
  });
});
