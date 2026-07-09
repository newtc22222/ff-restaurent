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
import { CircleDollarSign, BarChart2 } from 'lucide-react';
import type { Stats } from '../../api.js';
import { money } from '../../api.js';
import { PIE_COLORS } from '../../utils/helpers.js';
import EmptyState from '../ui/EmptyState.js';
import SectionTitle from '../ui/SectionTitle.js';
import StatCard from '../ui/StatCard.js';

interface StatsViewProps {
  /**
   * The stats data. Can be null if no data is available.
   */
  stats: Stats | null;
  /**
   * Translation utility function.
   */
  t: (key: string) => string;
}

/**
 * StatsView displays overall expenditure charts, status breakdowns, and monthly trends.
 */
export default function StatsView({ stats, t }: StatsViewProps) {
  if (!stats) {
    return (
      <EmptyState
        icon={BarChart2}
        title={t('stats.noStats')}
        description={t('stats.noStatsDesc')}
        steps={[t('bills.createBill'), t('bills.markPaid'), t('stats.title')]}
      />
    );
  }

  const paymentData = Object.entries(stats.byPaymentStatus).map(
    ([name, value]) => ({ name, value }),
  );
  const cuisineData = Object.entries(stats.byCuisineType)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const monthlyData = Object.entries(stats.byPeriod)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const freqRestaurant = Object.entries(stats.frequencyByRestaurant ?? {}).sort(
    (a, b) => b[1] - a[1],
  );
  const freqCuisine = Object.entries(stats.frequencyByCuisine ?? {}).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <div className="space-y-5">
      <SectionTitle title={t('stats.title')} subtitle={t('stats.subtitle')} />

      <div className="panel flex items-center gap-4 p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <CircleDollarSign size={22} />
        </div>
        <div>
          <div className="text-sm text-slate-500">{t('stats.totalPeriod')}</div>
          <div className="text-3xl font-bold">{money(stats.total)}</div>
        </div>
      </div>

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
                  {paymentData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => money(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              {paymentData.map((d, i) => (
                <div
                  key={d.name}
                  className="flex items-center gap-1.5 text-[12px]"
                >
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="font-medium">{d.name}</span>
                  <span className="text-slate-500">{money(d.value)}</span>
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
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
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

        {monthlyData.length > 0 && (
          <article className="panel p-4 md:col-span-2">
            <h3 className="mb-3 font-bold">{t('stats.monthlyTrend')}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={monthlyData}
                margin={{ left: 10, right: 10, top: 5, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip formatter={(value) => money(Number(value))} />
                <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </article>
        )}

        {freqRestaurant.length > 0 && (
          <article className="panel p-4">
            <h3 className="mb-3 font-bold">{t('stats.frequencyRestaurant')}</h3>
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
    </div>
  );
}
