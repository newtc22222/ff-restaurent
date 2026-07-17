import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Grid2X2,
  LayoutDashboard,
  List,
  Plus,
  SlidersHorizontal,
  Table2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import DatePicker from 'react-datepicker';
import { enUS, vi } from 'date-fns/locale';
import { useLoaderData, useNavigate, useSearchParams } from 'react-router';
import type { Bill, BillPage, BillParticipant, User } from '../lib/api';
import { money } from '../lib/api';
import { canChef, isHead, canManageBill } from '../lib/helpers';
import { useAppContext } from '../app/providers/app-context';
import { useI18n } from '../app/providers/i18n';
import { useMutation } from '../hooks/useMutation';
import Dropdown from '../components/ui/Dropdown';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const parseDateOnly = (value: string) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const formatDateOnly = (value: Date | null) => {
  if (!value) return undefined;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * BillsPage displays the list of bills with filters and action triggers for managing bills.
 */
export default function BillsPage() {
  const navigate = useNavigate();
  const { user, bills: snapshotBills } = useAppContext();
  const page = useLoaderData() as BillPage;
  const bills = page.items;
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsRef = useRef(searchParams);
  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);
  const { locale, t } = useI18n();
  const { mutate } = useMutation();
  const filterRestaurant = searchParams.get('restaurantId') ?? '';
  const filterMembers = (searchParams.get('participantIds') ?? '')
    .split(',')
    .filter(Boolean);
  const filterPayment = searchParams.get('paymentStatus') ?? 'all';
  const filterArchive = searchParams.get('archive') ?? 'active';
  const filterFrom = searchParams.get('from') ?? '';
  const filterTo = searchParams.get('to') ?? '';
  const sort = searchParams.get('sort') ?? 'created-desc';
  const limit = searchParams.get('limit') ?? '25';
  const [advancedOpen, setAdvancedOpen] = useState(
    Boolean(filterFrom || filterTo),
  );
  const [layout, setLayout] = useState<'card' | 'list' | 'table'>(() => {
    if (typeof window === 'undefined') return 'card';
    const stored = window.localStorage.getItem('ff-bills-layout');
    return stored === 'list' || stored === 'table' ? stored : 'card';
  });

  useEffect(() => {
    window.localStorage.setItem('ff-bills-layout', layout);
  }, [layout]);

  const setQuery = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParamsRef.current);
    next.delete('cursor');
    next.delete('direction');
    if (value) next.set(key, value);
    else next.delete(key);
    searchParamsRef.current = next;
    setSearchParams(next);
  };

  const goToPage = (cursor: string, direction: 'forward' | 'backward') => {
    const next = new URLSearchParams(searchParamsRef.current);
    next.set('cursor', cursor);
    next.set('direction', direction);
    searchParamsRef.current = next;
    setSearchParams(next);
  };

  const restaurantOptions = Array.from(
    new Map(
      snapshotBills.map((bill) => [
        bill.restaurant.id,
        { value: bill.restaurant.id, label: bill.restaurant.name },
      ]),
    ).values(),
  );

  const memberOptions = Array.from(
    new Map(
      snapshotBills.flatMap((bill) =>
        bill.participants.map((participant) => [
          participant.memberId,
          { value: participant.memberId, label: participant.member.name },
        ]),
      ),
    ).values(),
  );

  const activeFilterCount =
    (filterRestaurant ? 1 : 0) +
    (filterMembers.length > 0 ? 1 : 0) +
    (filterPayment !== 'all' ? 1 : 0) +
    (filterArchive !== 'active' ? 1 : 0) +
    (filterFrom ? 1 : 0) +
    (filterTo ? 1 : 0) +
    (sort !== 'created-desc' ? 1 : 0);

  const runAction = (
    intent: 'bill-reminders' | 'bill-status',
    billId: string,
    fallback: string,
    success: string,
    status?: 'archive' | 'restore',
  ) =>
    mutate(
      { intent, billId, ...(status ? { status } : {}) },
      { fallback, success },
    );

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[22px] font-bold text-ink">{t('bills.title')}</h2>
          <p className="mt-1 text-[13px] text-slate-500">
            {t('bills.scopeNote')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border bg-surface p-1">
            {(
              [
                ['card', Grid2X2, 'bills.layoutCard'],
                ['list', List, 'bills.layoutList'],
                ['table', Table2, 'bills.layoutTable'],
              ] as const
            ).map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                className={`grid h-8 w-9 place-items-center rounded-md transition-colors ${
                  layout === value
                    ? 'bg-ink text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-500 hover:bg-muted hover:text-ink'
                }`}
                aria-label={t(label)}
                aria-pressed={layout === value}
                onClick={() => setLayout(value)}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
          {canChef(user) && (
            <button
              className="btn btn-primary h-10 px-4 text-[13px]"
              onClick={() => navigate('/bills/new')}
            >
              <Plus size={14} /> {t('bills.createBill')}
            </button>
          )}
        </div>
      </div>

      <section className="panel mb-5 space-y-3 p-3">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <Dropdown
            label={t('bills.sort')}
            ariaLabel={t('bills.sort')}
            value={sort}
            onChange={(value) => setQuery('sort', value)}
            options={[
              { value: 'created-desc', label: t('bills.newest') },
              { value: 'created-asc', label: t('bills.oldest') },
              { value: 'total-desc', label: t('bills.highestTotal') },
              { value: 'total-asc', label: t('bills.lowestTotal') },
            ]}
          />
          {isHead(user) ? (
            <Dropdown
              label={t('bills.status')}
              ariaLabel={t('bills.status')}
              value={filterArchive}
              onChange={(value) => setQuery('archive', value)}
              options={[
                { value: 'active', label: t('bills.activeOnly') },
                { value: 'archived', label: t('bills.archivedOnly') },
                { value: 'all', label: t('bills.allStatuses') },
              ]}
            />
          ) : !canChef(user) ? (
            <Dropdown
              label={t('bills.status')}
              ariaLabel={t('bills.status')}
              value={filterPayment}
              onChange={(value) =>
                setQuery('paymentStatus', value === 'all' ? undefined : value)
              }
              options={[
                { value: 'all', label: t('bills.allStatuses') },
                { value: 'PAID', label: t('bills.filterPaid') },
                { value: 'WAITING', label: t('bills.filterUnpaid') },
              ]}
            />
          ) : (
            <div className="hidden xl:block" />
          )}
          <Dropdown
            label={t('bills.filterRestaurant')}
            value={filterRestaurant}
            options={restaurantOptions}
            onChange={(value) => setQuery('restaurantId', value)}
            allowClear
            clearLabel={t('bills.clearAll')}
            searchable
            searchPlaceholder={t('bills.searchRestaurants')}
            emptyMessage={t('bills.noFilterResults')}
          />
          {canChef(user) && (
            <Dropdown
              multiple
              label={t('bills.filterMember')}
              values={filterMembers}
              options={memberOptions}
              onChange={(values) =>
                setQuery('participantIds', values.join(','))
              }
              allowClear
              clearLabel={t('bills.clearAll')}
              formatSelection={(selected) =>
                selected.length === 1
                  ? (selected[0]?.label.split(' ')[0] ?? '')
                  : `${selected.length} ${t('bills.filterMember')}`
              }
              searchable
              searchPlaceholder={t('bills.searchMembers')}
              emptyMessage={t('bills.noFilterResults')}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <button
            type="button"
            className="btn btn-soft h-9"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((current) => !current)}
          >
            <SlidersHorizontal size={14} /> {t('bills.advancedFilters')}
            {(filterFrom || filterTo) && (
              <span className="h-2 w-2 rounded-full bg-[#e9900c]" />
            )}
          </button>
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="text-[12px] font-semibold text-slate-400 transition-colors hover:text-red-500"
              onClick={() => {
                searchParamsRef.current = new URLSearchParams();
                setSearchParams({});
              }}
            >
              {t('bills.clearAll')}
            </button>
          )}
        </div>
        {advancedOpen && (
          <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">{t('bills.from')}</span>
              <DatePicker
                selected={parseDateOnly(filterFrom)}
                onChange={(date: Date | null) =>
                  setQuery('from', formatDateOnly(date))
                }
                maxDate={parseDateOnly(filterTo) ?? undefined}
                locale={locale === 'vi' ? vi : enUS}
                dateFormat="dd/MM/yyyy"
                placeholderText={t('bills.chooseDate')}
                className="field w-full"
                wrapperClassName="w-full"
                isClearable
              />
            </label>
            <label className="space-y-1">
              <span className="label">{t('bills.to')}</span>
              <DatePicker
                selected={parseDateOnly(filterTo)}
                onChange={(date: Date | null) =>
                  setQuery('to', formatDateOnly(date))
                }
                minDate={parseDateOnly(filterFrom) ?? undefined}
                locale={locale === 'vi' ? vi : enUS}
                dateFormat="dd/MM/yyyy"
                placeholderText={t('bills.chooseDate')}
                className="field w-full"
                wrapperClassName="w-full"
                isClearable
              />
            </label>
          </div>
        )}
      </section>

      {bills.length === 0 && activeFilterCount === 0 && (
        <EmptyState
          icon={LayoutDashboard}
          title={t('bills.noBills')}
          description={t('bills.noBillsDesc')}
          steps={[
            t('createBill.restaurant'),
            t('createBill.participants'),
            t('bills.remind'),
          ]}
        />
      )}
      {bills.length === 0 && activeFilterCount > 0 && (
        <EmptyState
          icon={LayoutDashboard}
          title={t('bills.noMatch')}
          description={t('bills.clearFiltersHint')}
          steps={[]}
        />
      )}

      {layout === 'card' && (
        <div className="grid gap-4 xl:grid-cols-2">
          {bills.map((bill) => (
            <BillCard
              key={bill.id}
              bill={bill}
              user={user}
              onView={() => navigate(`/bills/${bill.id}`)}
              onRemind={() =>
                runAction(
                  'bill-reminders',
                  bill.id,
                  t('toast.remindersFailed'),
                  t('toast.remindersProcessed'),
                )
              }
              onArchive={() =>
                runAction(
                  'bill-status',
                  bill.id,
                  t('toast.billArchiveFailed'),
                  t('toast.billArchived'),
                  'archive',
                )
              }
              onRestore={() =>
                runAction(
                  'bill-status',
                  bill.id,
                  t('toast.billRestoreFailed'),
                  t('toast.billRestored'),
                  'restore',
                )
              }
              t={t}
            />
          ))}
        </div>
      )}
      {layout === 'list' && (
        <div className="space-y-2">
          {bills.map((bill) => (
            <BillListRow
              key={bill.id}
              bill={bill}
              locale={locale}
              onView={() => navigate(`/bills/${bill.id}`)}
              t={t}
            />
          ))}
        </div>
      )}
      {layout === 'table' && (
        <BillTable
          bills={bills}
          locale={locale}
          onView={(bill) => navigate(`/bills/${bill.id}`)}
          t={t}
        />
      )}

      <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Dropdown
          label={t('bills.rowsPerPage')}
          ariaLabel={t('bills.rowsPerPage')}
          value={limit}
          onChange={(value) =>
            setQuery('limit', value === '25' ? undefined : value)
          }
          options={['10', '25', '50'].map((value) => ({
            value,
            label: `${value} ${t('bills.rows')}`,
          }))}
          fullWidth={false}
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-soft"
            disabled={
              !page.pageInfo.hasPreviousPage || !page.pageInfo.startCursor
            }
            onClick={() =>
              page.pageInfo.startCursor &&
              goToPage(page.pageInfo.startCursor, 'backward')
            }
          >
            <ChevronLeft size={14} /> {t('common.previousPage')}
          </button>
          <button
            type="button"
            className="btn btn-soft"
            disabled={!page.pageInfo.hasNextPage || !page.pageInfo.endCursor}
            onClick={() =>
              page.pageInfo.endCursor &&
              goToPage(page.pageInfo.endCursor, 'forward')
            }
          >
            {t('common.nextPage')} <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

interface BillCardProps {
  bill: Bill;
  user: User;
  onView: () => void;
  onRemind: () => void;
  onArchive: () => void;
  onRestore: () => void;
  t: (key: string) => string;
}

interface CompactBillProps {
  bill: Bill;
  locale: string;
  onView: () => void;
  t: (key: string) => string;
}

function billPaymentSummary(bill: Bill) {
  const paid = bill.participants.filter(
    (participant) => participant.paymentStatus === 'PAID',
  ).length;
  return {
    paid,
    total: bill.participants.length,
    allPaid: bill.participants.length > 0 && paid === bill.participants.length,
  };
}

function BillListRow({ bill, locale, onView, t }: CompactBillProps) {
  const summary = billPaymentSummary(bill);
  const createdAt = new Intl.DateTimeFormat(
    locale === 'vi' ? 'vi-VN' : 'en-US',
    { dateStyle: 'medium' },
  ).format(new Date(bill.createdAt));

  return (
    <button
      type="button"
      className="panel flex w-full flex-col gap-3 p-4 text-left transition hover:border-slate-300 hover:shadow-sm sm:flex-row sm:items-center"
      onClick={onView}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-bold text-ink">
            {bill.restaurant.name}
          </h3>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              summary.allPaid
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
            }`}
          >
            {summary.allPaid ? t('bills.settled') : bill.status}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {createdAt} · {bill.createdBy.name} · {summary.paid} {t('bills.of')}{' '}
          {summary.total} {t('bills.paidCount')}
        </p>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <p className="text-base font-bold text-ink">{money(bill.totalCost)}</p>
        <ChevronRight size={16} className="text-slate-400" aria-hidden="true" />
      </div>
    </button>
  );
}

interface BillTableProps {
  bills: Bill[];
  locale: string;
  onView: (bill: Bill) => void;
  t: (key: string) => string;
}

function BillTable({ bills, locale, onView, t }: BillTableProps) {
  const date = new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'medium',
  });

  return (
    <>
      <div className="space-y-2 md:hidden">
        {bills.map((bill) => (
          <BillListRow
            key={bill.id}
            bill={bill}
            locale={locale}
            onView={() => onView(bill)}
            t={t}
          />
        ))}
      </div>
      <div className="panel hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-border bg-muted/60">
            <tr className="label">
              <th className="px-4 py-3">{t('bills.restaurant')}</th>
              <th className="px-4 py-3">{t('bills.date')}</th>
              <th className="px-4 py-3">{t('bills.createdBy')}</th>
              <th className="px-4 py-3">{t('bills.paymentProgress')}</th>
              <th className="px-4 py-3 text-right">{t('bills.total')}</th>
              <th className="w-12 px-4 py-3">
                <span className="sr-only">{t('bills.viewDetail')}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {bills.map((bill) => {
              const summary = billPaymentSummary(bill);
              return (
                <tr
                  key={bill.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => onView(bill)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onView(bill);
                    }
                  }}
                  tabIndex={0}
                >
                  <td className="px-4 py-3 font-semibold text-ink">
                    {bill.restaurant.name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {date.format(new Date(bill.createdAt))}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {bill.createdBy.name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {summary.paid} {t('bills.of')} {summary.total}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-ink">
                    {money(bill.totalCost)}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    <ChevronRight size={15} aria-hidden="true" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * BillCard displays a summary of a single bill card.
 */
function BillCard({
  bill,
  user,
  onView,
  onRemind,
  onArchive,
  onRestore,
  t,
}: BillCardProps) {
  const [confirmAction, setConfirmAction] = useState<
    'archive' | 'restore' | null
  >(null);
  const paid = bill.participants.filter(
    (participant) => participant.paymentStatus === 'PAID',
  ).length;
  const total = bill.participants.length;
  const percentage = total ? Math.round((paid / total) * 100) : 0;
  const allPaid = total > 0 && paid === total;
  const canManage = canManageBill(bill, user);

  return (
    <>
      <article className="rounded-xl border border-border bg-surface p-5 transition-shadow hover:shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[16px] font-bold text-ink">
              {bill.restaurant.name}
            </h3>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {bill.restaurant.type} / {bill.restaurant.cuisineType} / by{' '}
              {bill.createdBy.name}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[20px] font-bold text-ink">
              {money(bill.totalCost)}
            </p>
            <span
              className={`text-[11px] font-semibold uppercase tracking-wide ${
                allPaid ? 'text-emerald-500' : 'text-[#e9900c]'
              }`}
            >
              {allPaid ? t('bills.settled') : bill.status}
            </span>
          </div>
        </div>

        <div className="mb-3">
          <div className="mb-1 flex justify-between text-[12px] text-slate-500">
            <span>
              {paid} {t('bills.of')} {total} {t('bills.paidCount')}
            </span>
            <span>{percentage}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {bill.participants.map((participant) => (
            <PaymentChip key={participant.memberId} participant={participant} />
          ))}
        </div>

        <div className="flex gap-2 border-t border-muted pt-3">
          <button
            className="btn btn-primary h-8 flex-1 px-3 text-[13px]"
            onClick={onView}
          >
            {t('bills.viewDetail')} <ChevronRight size={13} />
          </button>
          {canManage && canChef(user) && (
            <button
              className="btn btn-soft h-8 px-3 text-[13px]"
              onClick={onRemind}
            >
              {t('bills.remind')}
            </button>
          )}
          {isHead(user) && bill.status === 'ACTIVE' && (
            <button
              className="btn btn-soft h-8 px-3 text-[13px]"
              onClick={() => setConfirmAction('archive')}
            >
              {t('bills.archive')}
            </button>
          )}
          {isHead(user) && bill.status === 'ARCHIVED' && (
            <button
              className="btn btn-soft h-8 px-3 text-[13px]"
              onClick={() => setConfirmAction('restore')}
            >
              {t('bills.restore')}
            </button>
          )}
        </div>
      </article>
      {confirmAction && (
        <ConfirmDialog
          title={
            confirmAction === 'archive'
              ? t('bills.archiveBill')
              : t('bills.restoreBill')
          }
          message={
            confirmAction === 'archive'
              ? t('bills.confirmArchive')
              : t('bills.confirmRestore')
          }
          onConfirm={() => {
            setConfirmAction(null);
            confirmAction === 'archive' ? onArchive() : onRestore();
          }}
          onCancel={() => setConfirmAction(null)}
          t={t}
        />
      )}
    </>
  );
}

interface PaymentChipProps {
  participant: BillParticipant;
}

/**
 * PaymentChip displays participant summary and payment status (check or clock icon).
 */
function PaymentChip({ participant }: PaymentChipProps) {
  const paid = participant.paymentStatus === 'PAID';
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${
        paid
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
          : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
      }`}
    >
      {paid ? <CheckCircle2 size={11} /> : <Clock size={11} />}
      {participant.member.name.split(' ')[0]} / {money(participant.finalPrice)}
    </div>
  );
}
