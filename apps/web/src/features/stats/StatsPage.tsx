import { BarChart2, CalendarDays } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLoaderData, useSearchParams } from 'react-router';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { Stats } from '@/api/types';
import { useI18n } from '@/app/providers/i18n';
import DatePicker from '@/components/ui/DatePicker';
import Dropdown from '@/components/ui/Dropdown';
import EmptyState from '@/components/ui/EmptyState';
import SectionTitle from '@/components/ui/SectionTitle';
import StatCard from '@/components/ui/StatCard';
import { money } from '@/lib/currency';
import { formatDateOnlyForLocale } from '@/lib/date-only';

type StatsRange = 'weekly' | 'monthly' | 'yearly' | 'custom';

const inputDate = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

const defaultCustomDates = () => {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - 1);
  return { from: inputDate(from), to: inputDate(to) };
};

/** Displays the authenticated user's obligations for a selectable date range. */
export default function StatsPage() {
  const stats = useLoaderData<Stats>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, locale } = useI18n();
  const requestedRange = searchParams.get('range');
  const range: StatsRange = ['weekly', 'monthly', 'yearly', 'custom'].includes(
    requestedRange ?? '',
  )
    ? (requestedRange as StatsRange)
    : 'monthly';
  const defaults = defaultCustomDates();
  const [from, setFrom] = useState(searchParams.get('from') ?? defaults.from);
  const [to, setTo] = useState(searchParams.get('to') ?? defaults.to);

  useEffect(() => {
    setFrom(searchParams.get('from') ?? defaults.from);
    setTo(searchParams.get('to') ?? defaults.to);
  }, [searchParams, defaults.from, defaults.to]);

  const rangeOptions = [
    { value: 'weekly', label: t('stats.weekly') },
    { value: 'monthly', label: t('stats.monthly') },
    { value: 'yearly', label: t('stats.yearly') },
    { value: 'custom', label: t('stats.custom') },
  ];
  const customRangeInvalid = !from || !to || from > to;
  const selectRange = (value: string) => {
    const nextRange = value as StatsRange;
    if (nextRange === 'custom') {
      setSearchParams({ range: nextRange, from, to });
    } else {
      setSearchParams({ range: nextRange });
    }
  };
  const applyCustomRange = () => {
    if (!customRangeInvalid) setSearchParams({ range: 'custom', from, to });
  };

  const totalObligation = stats.totals.totalObligation;
  const segmentPct = (value: number) =>
    totalObligation ? (value / totalObligation) * 100 : 0;
  const paidPct = segmentPct(stats.totals.paid);
  const sponsoredForMePct = segmentPct(stats.totals.sponsoredForMe);
  const waitingPct = segmentPct(stats.totals.waiting);

  const appliedFrom = searchParams.get('from');
  const appliedTo = searchParams.get('to');
  const periodLabel =
    range === 'custom'
      ? appliedFrom && appliedTo
        ? `${formatDateOnlyForLocale(appliedFrom, locale)} – ${formatDateOnlyForLocale(appliedTo, locale)}`
        : ''
      : t(`stats.${range}`);

  const cuisineData = Object.entries(stats.byCuisineType)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const periodData = Object.entries(stats.byPeriod)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const freqRestaurant = Object.entries(stats.frequencyByRestaurant ?? {}).sort(
    (a, b) => b[1] - a[1],
  );
  const freqCuisine = Object.entries(stats.frequencyByCuisine ?? {}).sort(
    (a, b) => b[1] - a[1],
  );
  const hasData =
    stats.totals.totalObligation > 0 || stats.totals.sponsoredByMe > 0;

  return (
    <div className="min-w-0 space-y-5">
      <SectionTitle title={t('stats.title')} subtitle={t('stats.subtitle')} />

      <section className="panel min-w-0 p-4" aria-label={t('stats.range')}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full sm:w-56">
            <div className="label mb-1.5">{t('stats.range')}</div>
            <Dropdown
              label={t('stats.range')}
              options={rangeOptions}
              value={range}
              onChange={selectRange}
              icon={<CalendarDays size={15} />}
              ariaLabel={t('stats.range')}
            />
          </div>

          {range === 'custom' && (
            <div className="grid w-full min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:max-w-2xl">
              <label>
                <span className="label mb-1.5 block">{t('stats.from')}</span>
                <DatePicker value={from} onChange={setFrom} />
              </label>
              <label>
                <span className="label mb-1.5 block">{t('stats.to')}</span>
                <DatePicker value={to} onChange={setTo} />
              </label>
              <button
                type="button"
                className="btn btn-primary w-full self-end sm:w-auto"
                disabled={customRangeInvalid}
                onClick={applyCustomRange}
              >
                {t('stats.applyRange')}
              </button>
            </div>
          )}
        </div>
        {range === 'custom' && customRangeInvalid && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {t('stats.invalidRange')}
          </p>
        )}
      </section>

      <section className="panel relative min-w-0 overflow-visible p-5 sm:p-6">
        <span
          className="ticket-perforation ticket-perforation-top"
          aria-hidden="true"
        />
        <span
          className="ticket-perforation ticket-perforation-bottom"
          aria-hidden="true"
        />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="title-mark" aria-hidden="true" />
          <span className="label">{t('stats.statementLabel')}</span>
          {periodLabel && (
            <span className="ml-auto text-2xs text-slate-500">
              {periodLabel}
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-sm">
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-basil"
              aria-hidden="true"
            />
            <span className="truncate">{t('stats.paid')}</span>
            <span
              className="min-w-[0.75rem] flex-1 border-b border-dotted border-border"
              aria-hidden="true"
            />
            <span className="ticket-figure shrink-0 font-mono">
              {money(stats.totals.paid)}
            </span>
          </div>

          {stats.totals.sponsoredForMe > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-success"
                aria-hidden="true"
              />
              <span className="truncate">{t('stats.sponsoredForMe')}</span>
              <span
                className="min-w-[0.75rem] flex-1 border-b border-dotted border-border"
                aria-hidden="true"
              />
              <span className="ticket-figure shrink-0 font-mono">
                {money(stats.totals.sponsoredForMe)}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-saffron"
              aria-hidden="true"
            />
            <span className="truncate">{t('stats.waiting')}</span>
            <span
              className="min-w-[0.75rem] flex-1 border-b border-dotted border-border"
              aria-hidden="true"
            />
            <span className="ticket-figure shrink-0 font-mono">
              {money(stats.totals.waiting)}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 border-t-2 border-ink/15 pt-3 dark:border-white/15">
          <span className="truncate text-base font-bold">
            {t('stats.totalObligation')}
          </span>
          <span
            className="min-w-[0.75rem] flex-1 border-b border-dotted border-border"
            aria-hidden="true"
          />
          <span className="ticket-figure shrink-0 font-mono text-xl font-bold">
            {money(stats.totals.totalObligation)}
          </span>
        </div>

        <div
          className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted"
          aria-hidden="true"
        >
          <div
            className="h-full bg-basil transition-all duration-500"
            style={{ width: `${paidPct}%` }}
          />
          <div
            className="h-full bg-success transition-all duration-500"
            style={{ width: `${sponsoredForMePct}%` }}
          />
          <div
            className="h-full bg-saffron transition-all duration-500"
            style={{ width: `${waitingPct}%` }}
          />
        </div>

        {stats.totals.sponsoredByMe > 0 && (
          <>
            <div className="ticket-perforation-break my-4" aria-hidden="true" />
            <div className="flex items-center gap-2 text-sm">
              <span className="truncate">{t('stats.sponsoredByMe')}</span>
              <span
                className="min-w-[0.75rem] flex-1 border-b border-dotted border-border"
                aria-hidden="true"
              />
              <span className="ticket-figure shrink-0 font-mono">
                {money(stats.totals.sponsoredByMe)}
              </span>
            </div>
          </>
        )}
      </section>

      {!hasData ? (
        <div className="panel p-5">
          <EmptyState
            icon={BarChart2}
            title={t('stats.noStats')}
            description={t('stats.noStatsDesc')}
            steps={[
              t('bills.createBill'),
              t('bills.markPaid'),
              t('stats.title'),
            ]}
          />
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          {cuisineData.length > 0 && (
            <article className="panel min-w-0 p-4 md:col-span-2">
              <h3 className="label mb-3">{t('stats.cuisineType')}</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={cuisineData}
                  layout="vertical"
                  margin={{ left: 60, right: 10, top: 5, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(value: number) =>
                      `${Math.round(value / 1000)}k`
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    width={55}
                  />
                  <Tooltip formatter={(value) => money(Number(value))} />
                  <Bar
                    dataKey="value"
                    fill="var(--color-accent)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </article>
          )}

          {periodData.length > 0 && (
            <article className="panel min-w-0 p-4 md:col-span-2">
              <h3 className="label mb-3">{t('stats.spendingTrend')}</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={periodData}
                  margin={{ left: 10, right: 10, top: 5, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                  />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(value: number) =>
                      `${Math.round(value / 1000)}k`
                    }
                  />
                  <Tooltip formatter={(value) => money(Number(value))} />
                  <Bar
                    dataKey="value"
                    fill="var(--color-accent)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </article>
          )}

          {freqRestaurant.length > 0 && (
            <article className="panel min-w-0 p-4">
              <h3 className="label mb-3">{t('stats.frequencyRestaurant')}</h3>
              <div className="space-y-2">
                {freqRestaurant.slice(0, 8).map(([name, count]) => (
                  <div
                    key={name}
                    className="flex min-w-0 items-center justify-between gap-3 text-sm"
                    data-testid="restaurant-frequency-row"
                  >
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
                      {count}×
                    </span>
                  </div>
                ))}
              </div>
            </article>
          )}

          {freqCuisine.length > 0 && (
            <article className="panel min-w-0 p-4">
              <h3 className="label mb-3">{t('stats.frequencyCuisine')}</h3>
              <div className="space-y-2">
                {freqCuisine.slice(0, 8).map(([name, count]) => (
                  <div
                    key={name}
                    className="flex min-w-0 items-center justify-between gap-3 text-sm"
                    data-testid="cuisine-frequency-row"
                  >
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
                      {count}×
                    </span>
                  </div>
                ))}
              </div>
            </article>
          )}

          <StatCard title={t('stats.restaurant')} data={stats.byEntry} />
        </div>
      )}
    </div>
  );
}
