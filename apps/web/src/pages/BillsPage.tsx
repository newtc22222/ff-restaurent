import {
  ChevronRight,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  Plus,
} from 'lucide-react';
import { useState } from 'react';
import { useLoaderData, useNavigate, useSearchParams } from 'react-router';
import type { Bill, BillParticipant, CatalogPage, User } from '../lib/api';
import { money } from '../lib/api';
import { canChef, isHead, canManageBill } from '../lib/helpers';
import { useAppContext } from '../app/providers/app-context';
import { useI18n } from '../app/providers/i18n';
import { useMutation } from '../hooks/useMutation';
import Dropdown from '../components/ui/Dropdown';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';

/**
 * BillsPage displays the list of bills with filters and action triggers for managing bills.
 */
export default function BillsPage() {
  const navigate = useNavigate();
  const { user, bills: snapshotBills } = useAppContext();
  const page = useLoaderData() as CatalogPage<Bill>;
  const bills = page.items;
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useI18n();
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

  const setQuery = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete('cursor');
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const goToNextPage = (cursor: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('cursor', cursor);
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
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-[22px] font-bold text-ink">{t('bills.title')}</h2>
        {canChef(user) && (
          <button
            className="btn btn-primary h-9 px-4 text-[13px]"
            onClick={() => navigate('/bills/new')}
          >
            <Plus size={14} /> {t('bills.createBill')}
          </button>
        )}
      </div>
      <p className="mb-4 text-[13px] text-slate-500">{t('bills.scopeNote')}</p>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Dropdown
          label={t('bills.filterRestaurant')}
          value={filterRestaurant}
          options={restaurantOptions}
          onChange={(value) => setQuery('restaurantId', value)}
          variant="filter"
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
            onChange={(values) => setQuery('participantIds', values.join(','))}
            variant="filter"
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
        {!canChef(user) && (
          <div className="flex gap-1 rounded-lg border border-border p-0.5">
            {(['all', 'PAID', 'WAITING'] as const).map((val) => (
              <button
                key={val}
                className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all ${
                  filterPayment === val
                    ? 'bg-ink text-white dark:bg-[hsl(210,20%,92%)] dark:text-[hsl(220,15%,9%)]'
                    : 'text-slate-500 hover:text-ink'
                }`}
                onClick={() =>
                  setQuery('paymentStatus', val === 'all' ? undefined : val)
                }
              >
                {val === 'all'
                  ? t('bills.title')
                  : val === 'PAID'
                    ? t('bills.filterPaid')
                    : t('bills.filterUnpaid')}
              </button>
            ))}
          </div>
        )}
        <select
          className="field h-8 min-w-36 py-0 text-[12px]"
          aria-label={t('bills.sort')}
          value={sort}
          onChange={(event) => setQuery('sort', event.target.value)}
        >
          <option value="created-desc">{t('bills.newest')}</option>
          <option value="created-asc">{t('bills.oldest')}</option>
          <option value="total-desc">{t('bills.highestTotal')}</option>
          <option value="total-asc">{t('bills.lowestTotal')}</option>
        </select>
        {isHead(user) && (
          <select
            className="field h-8 min-w-32 py-0 text-[12px]"
            aria-label={t('bills.archiveFilter')}
            value={filterArchive}
            onChange={(event) => setQuery('archive', event.target.value)}
          >
            <option value="active">{t('bills.activeOnly')}</option>
            <option value="archived">{t('bills.archivedOnly')}</option>
            <option value="all">{t('bills.allStatuses')}</option>
          </select>
        )}
        <label className="flex items-center gap-1 text-[11px] text-slate-500">
          {t('bills.from')}
          <input
            className="field h-8 w-32 py-0 text-[12px]"
            type="date"
            value={filterFrom}
            onChange={(event) => setQuery('from', event.target.value)}
          />
        </label>
        <label className="flex items-center gap-1 text-[11px] text-slate-500">
          {t('bills.to')}
          <input
            className="field h-8 w-32 py-0 text-[12px]"
            type="date"
            value={filterTo}
            onChange={(event) => setQuery('to', event.target.value)}
          />
        </label>
        {activeFilterCount > 0 && (
          <button
            className="ml-1 text-[12px] text-slate-400 transition-colors hover:text-red-400"
            onClick={() => {
              setSearchParams({});
            }}
          >
            {t('bills.clearAll')}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
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
        {page.pageInfo.hasNextPage && page.pageInfo.endCursor && (
          <button
            type="button"
            className="btn btn-soft w-full justify-center"
            onClick={() => goToNextPage(page.pageInfo.endCursor!)}
          >
            {t('common.nextPage')}
          </button>
        )}
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
