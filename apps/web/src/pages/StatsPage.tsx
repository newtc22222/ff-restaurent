import { useEffect, useState } from 'react';
import { useLoaderData, useSearchParams } from 'react-router';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  BarChart2,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  WalletCards,
} from 'lucide-react';
import { money, type Stats } from '../lib/api';
import { PIE_COLORS } from '../lib/helpers';
import { useI18n } from '../app/providers/i18n';
import Dropdown from '../components/ui/Dropdown';
import EmptyState from '../components/ui/EmptyState';
import SectionTitle from '../components/ui/SectionTitle';
import StatCard from '../components/ui/StatCard';

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
  const { t } = useI18n();
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

  const paymentData = [
    { name: t('stats.paid'), value: stats.totals.paid },
    { name: t('stats.waiting'), value: stats.totals.waiting },
  ].filter((item) => item.value > 0);
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
  const hasData = stats.totals.totalObligation > 0;

  return (
    <div className="space-y-5">
      <SectionTitle title={t('stats.title')} subtitle={t('stats.subtitle')} />

      <section className="panel p-4" aria-label={t('stats.range')}>
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
            <div className="grid w-full gap-3 sm:grid-cols-[1fr_1fr_auto] lg:max-w-2xl">
              <label>
                <span className="label mb-1.5 block">{t('stats.from')}</span>
                <input
                  className="field w-full"
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </label>
              <label>
                <span className="label mb-1.5 block">{t('stats.to')}</span>
                <input
                  className="field w-full"
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn btn-primary self-end"
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

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="panel flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <WalletCards size={19} />
          </div>
          <div className="min-w-0">
            <div className="text-sm text-slate-500">{t('stats.paid')}</div>
            <div className="truncate text-xl font-bold">
              {money(stats.totals.paid)}
            </div>
          </div>
        </article>
        <article className="panel flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e9900c] text-white">
            <Clock3 size={19} />
          </div>
          <div className="min-w-0">
            <div className="text-sm text-slate-500">{t('stats.waiting')}</div>
            <div className="truncate text-xl font-bold">
              {money(stats.totals.waiting)}
            </div>
          </div>
        </article>
        <article className="panel flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink text-white dark:bg-[hsl(210,20%,92%)] dark:text-[hsl(220,15%,9%)]">
            <CircleDollarSign size={19} />
          </div>
          <div className="min-w-0">
            <div className="text-sm text-slate-500">
              {t('stats.totalObligation')}
            </div>
            <div className="truncate text-xl font-bold">
              {money(stats.totals.totalObligation)}
            </div>
          </div>
        </article>
      </div>

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
        <div className="grid gap-4 md:grid-cols-2">
          {paymentData.length > 0 && (
            <article className="panel p-4">
              <h3 className="mb-3 font-bold">{t('stats.paymentStatus')}</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {paymentData.map((_, index) => (
                      <Cell
                        key={index}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => money(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                {paymentData.map((item, index) => (
                  <div
                    key={item.name}
                    className="flex items-center gap-1.5 text-[12px]"
                  >
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background: PIE_COLORS[index % PIE_COLORS.length],
                      }}
                    />
                    <span className="font-medium">{item.name}</span>
                    <span className="text-slate-500">{money(item.value)}</span>
                  </div>
                ))}
              </div>
            </article>
          )}

          {cuisineData.length > 0 && (
            <article className="panel p-4">
              <h3 className="mb-3 font-bold">{t('stats.cuisineType')}</h3>
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
                  <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </article>
          )}

          {periodData.length > 0 && (
            <article className="panel p-4 md:col-span-2">
              <h3 className="mb-3 font-bold">{t('stats.spendingTrend')}</h3>
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
                  <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </article>
          )}

          {freqRestaurant.length > 0 && (
            <article className="panel p-4">
              <h3 className="mb-3 font-bold">
                {t('stats.frequencyRestaurant')}
              </h3>
              <div className="space-y-2">
                {freqRestaurant.slice(0, 8).map(([name, count]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate">{name}</span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[12px] font-bold">
                      {count}×
                    </span>
                  </div>
                ))}
              </div>
            </article>
          )}

          {freqCuisine.length > 0 && (
            <article className="panel p-4">
              <h3 className="mb-3 font-bold">{t('stats.frequencyCuisine')}</h3>
              <div className="space-y-2">
                {freqCuisine.slice(0, 8).map(([name, count]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate">{name}</span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[12px] font-bold">
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
