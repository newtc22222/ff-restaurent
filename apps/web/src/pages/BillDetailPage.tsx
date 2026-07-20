import { useState } from 'react';
import {
  Archive as ArchiveIcon,
  BellRing,
  CheckCircle2,
  CirclePlus,
  Clock,
  Edit3,
  ExternalLink,
  History,
  PencilLine,
  RotateCcw,
  WalletCards,
} from 'lucide-react';
import { Navigate, useLoaderData, useNavigate, useParams } from 'react-router';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
  money,
  type BillActivityAction,
  type BillActivityEvent,
} from '../lib/api';
import {
  PIE_COLORS,
  canChef,
  isHead,
  canManageBill,
  initials,
} from '../lib/helpers';
import { useAppContext } from '../app/providers/app-context';
import { useI18n } from '../app/providers/i18n';
import { useMutation } from '../hooks/useMutation';
import BackButton from '../components/ui/BackButton';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const activityIcon = (action: BillActivityAction) => {
  switch (action) {
    case 'CREATED':
      return CirclePlus;
    case 'UPDATED':
      return PencilLine;
    case 'PAYMENT_STATUS_CHANGED':
      return WalletCards;
    case 'REMINDERS_SENT':
      return BellRing;
    case 'ARCHIVED':
      return ArchiveIcon;
    case 'RESTORED':
      return RotateCcw;
  }
};

const activityTone = (action: BillActivityAction) => {
  switch (action) {
    case 'PAYMENT_STATUS_CHANGED':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
    case 'REMINDERS_SENT':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300';
    case 'ARCHIVED':
      return 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300';
    case 'RESTORED':
      return 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300';
    default:
      return 'bg-muted text-slate-600 dark:text-slate-300';
  }
};

/**
 * BillDetailPage displays a breakdown of a single bill including participant costs and payment buttons.
 */
export default function BillDetailPage() {
  const navigate = useNavigate();
  const { billId } = useParams();
  const activity = useLoaderData<BillActivityEvent[]>();
  const { user, bills } = useAppContext();
  const { locale, t } = useI18n();
  const { mutate } = useMutation();
  const [confirmAction, setConfirmAction] = useState<
    'archive' | 'restore' | null
  >(null);
  const [pendingPayment, setPendingPayment] = useState<{
    memberId: string;
    current: 'PAID' | 'WAITING';
  } | null>(null);

  const bill = bills.find((candidate) => candidate.id === billId);
  if (!bill) return <Navigate to="/bills" replace />;

  const onBack = () => navigate('/bills');

  const paid = bill.participants.filter(
    (participant) => participant.paymentStatus === 'PAID',
  ).length;
  const percentage = bill.participants.length
    ? Math.round((paid / bill.participants.length) * 100)
    : 0;
  const allPaid =
    bill.participants.length > 0 && paid === bill.participants.length;
  const canManage = canManageBill(bill, user);
  const pieData = bill.participants.map((p) => ({
    name: p.member.name.split(' ')[0],
    value: p.finalPrice,
  }));
  const dateTime = new Intl.DateTimeFormat(
    locale === 'vi' ? 'vi-VN' : 'en-US',
    { dateStyle: 'medium', timeStyle: 'short' },
  );
  const activityTitle = (action: BillActivityAction) => {
    const keys: Record<BillActivityAction, string> = {
      CREATED: 'activity.created',
      UPDATED: 'activity.updated',
      PAYMENT_STATUS_CHANGED: 'activity.paymentChanged',
      REMINDERS_SENT: 'activity.remindersSent',
      ARCHIVED: 'activity.archived',
      RESTORED: 'activity.restored',
    };
    return t(keys[action]);
  };
  const paymentLabel = (status?: string) =>
    status === 'PAID'
      ? t('bills.paid')
      : status === 'WAITING'
        ? t('bills.waiting')
        : undefined;
  const activitySummary = (event: BillActivityEvent) => {
    if (event.action === 'UPDATED' && event.details?.changes?.length) {
      const changes = event.details.changes.map((change) =>
        t(`activity.change.${change}`),
      );
      return `${t('activity.changed')}: ${changes.join(', ')}`;
    }
    if (event.action === 'PAYMENT_STATUS_CHANGED') {
      const member = event.details?.memberName ?? t('activity.participant');
      const from = paymentLabel(event.details?.fromStatus);
      const to = paymentLabel(event.details?.toStatus);
      return from && to ? `${member}: ${from} → ${to}` : member;
    }
    if (event.action === 'REMINDERS_SENT') {
      return `${event.details?.sent ?? 0} ${t('activity.sent')} · ${event.details?.skipped ?? 0} ${t('activity.skipped')}`;
    }
    return null;
  };

  return (
    <>
      <div className="mx-auto w-full max-w-6xl py-2">
        <BackButton onClick={onBack} label={t('bills.backToBills')} />

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] lg:items-start">
          <div className="space-y-4">
            <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-[22px] font-bold text-ink">
                    {bill.restaurant.name}
                  </h2>
                  <p className="mt-0.5 text-[13px] text-slate-500">
                    {bill.restaurant.type} / {bill.restaurant.cuisineType} /
                    created by {bill.createdBy.name}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[28px] font-bold leading-none text-ink">
                    {money(bill.totalCost)}
                  </p>
                  <span
                    className={`mt-1 inline-block text-[11px] font-semibold uppercase tracking-wide ${
                      allPaid ? 'text-emerald-500' : 'text-[#e9900c]'
                    }`}
                  >
                    {allPaid ? t('bills.settled') : bill.status}
                  </span>
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex justify-between text-[12px] text-slate-500">
                  <span>
                    {paid} {t('bills.of')} {bill.participants.length}{' '}
                    {t('bills.paidCount')}
                  </span>
                  <span>{percentage}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </section>

            {(bill.discounts.length > 0 || bill.vouchers.length > 0) && (
              <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                <h3 className="label mb-3">Adjustments</h3>
                <div className="space-y-2 text-sm">
                  {bill.discounts.map((discount, index) => (
                    <div
                      key={`discount-${index}`}
                      className="flex justify-between"
                    >
                      <span>
                        {discount.label || `Discount ${index + 1}`} (
                        {discount.type})
                      </span>
                      <span className="font-semibold text-emerald-600">
                        −
                        {discount.type === 'PERCENTAGE'
                          ? `${discount.value}%`
                          : money(discount.value)}
                      </span>
                    </div>
                  ))}
                  {bill.vouchers.map((voucher) => (
                    <div key={voucher.code} className="flex justify-between">
                      <span>Voucher {voucher.code}</span>
                      <span className="font-semibold text-emerald-600">
                        −{money(voucher.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {pieData.length > 1 && (
              <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                <h3 className="label mb-3">Bill share breakdown</h3>
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell
                            key={index}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => money(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-3">
                  {pieData.map((d, i) => (
                    <div
                      key={d.name}
                      className="flex items-center gap-1.5 text-[12px]"
                    >
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          background: PIE_COLORS[i % PIE_COLORS.length],
                        }}
                      />
                      <span className="font-medium">{d.name}</span>
                      <span className="text-slate-500">{money(d.value)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {bill.paymentQrImage ? (
              <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                <p className="label mb-3">
                  {t('bills.paymentQr')} · {bill.paymentQrImage.label}
                </p>
                <img
                  src={bill.paymentQrImage.imageUrl}
                  alt={bill.paymentQrImage.label}
                  className="mx-auto aspect-square w-full max-w-56 rounded-lg bg-white object-contain p-2"
                />
              </section>
            ) : bill.paymentUrl ? (
              <a
                className="btn btn-primary w-full"
                href={bill.paymentUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open secure payment link <ExternalLink size={14} />
              </a>
            ) : null}

            {canManage && canChef(user) && (
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="btn btn-soft flex-1"
                  onClick={() => navigate(`/bills/${bill.id}/edit`)}
                >
                  <Edit3 size={14} /> {t('bills.editBill')}
                </button>
                {isHead(user) && bill.status === 'ACTIVE' && (
                  <button
                    className="btn btn-soft flex-1 hover:border-red-300 hover:text-red-500"
                    onClick={() => setConfirmAction('archive')}
                  >
                    {t('bills.archiveBill')}
                  </button>
                )}
                {isHead(user) && bill.status === 'ARCHIVED' && (
                  <button
                    className="btn btn-soft flex-1 hover:border-emerald-300 hover:text-emerald-500"
                    onClick={() => setConfirmAction('restore')}
                  >
                    {t('bills.restoreBill')}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
              <div className="flex items-center justify-between border-b border-muted px-5 py-3">
                <span className="label">{t('bills.memberBreakdown')}</span>
                <span className="label">{t('bills.amountStatus')}</span>
              </div>
              {bill.participants.map((participant, index) => (
                <div
                  key={participant.memberId}
                  className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center ${
                    index < bill.participants.length - 1
                      ? 'border-b border-[#f8fafc] dark:border-[hsl(220,15%,18%)]'
                      : ''
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-bold text-ink">
                      {initials(participant.member.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-ink">
                        {participant.member.name}
                      </p>
                      <p className="mt-0.5 text-[12px] text-slate-500">
                        Base {money(participant.originCost)} / VAT{' '}
                        {money(participant.allocatedVat)} / Ship{' '}
                        {money(participant.allocatedShipping)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="text-right">
                      <p className="text-[14px] font-bold">
                        {money(participant.finalPrice)}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                          participant.paymentStatus === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {participant.paymentStatus === 'PAID' ? (
                          <CheckCircle2 size={11} />
                        ) : (
                          <Clock size={11} />
                        )}
                        {participant.paymentStatus === 'PAID'
                          ? t('bills.paid')
                          : t('bills.waiting')}
                      </span>
                    </div>
                    {(canManage || participant.memberId === user.id) && (
                      <button
                        className="btn btn-soft h-8 px-3 text-[12px]"
                        onClick={() =>
                          setPendingPayment({
                            memberId: participant.memberId,
                            current: participant.paymentStatus,
                          })
                        }
                      >
                        {participant.paymentStatus === 'WAITING'
                          ? t('bills.markPaid')
                          : 'Correct'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </section>

            {canManage && canChef(user) && (
              <button
                className="btn btn-soft w-full"
                disabled={allPaid}
                title={allPaid ? 'All members have paid' : undefined}
                onClick={() =>
                  void mutate(
                    { intent: 'bill-reminders' },
                    {
                      fallback: t('toast.remindersFailed'),
                      success: t('toast.remindersProcessed'),
                    },
                  )
                }
              >
                {t('bills.sendReminders')}
              </button>
            )}

            <section className="panel overflow-hidden">
              <div className="flex items-start gap-3 border-b border-border px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-ink">
                  <History size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">
                    {t('activity.title')}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t('activity.subtitle')}
                  </p>
                </div>
              </div>
              {activity.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-slate-500">
                  {t('activity.noEvents')}
                </p>
              ) : (
                <ol className="divide-y divide-border">
                  {activity.map((event) => {
                    const ActivityIcon = activityIcon(event.action);
                    const summary = activitySummary(event);
                    return (
                      <li key={event.id} className="flex gap-3 px-5 py-4">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${activityTone(event.action)}`}
                        >
                          <ActivityIcon size={15} aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                            <p className="text-sm font-semibold text-ink">
                              {activityTitle(event.action)}
                            </p>
                            <time
                              className="shrink-0 text-xs text-slate-500"
                              dateTime={event.createdAt}
                            >
                              {dateTime.format(new Date(event.createdAt))}
                            </time>
                          </div>
                          {summary && (
                            <p className="mt-1 text-xs text-slate-500">
                              {summary}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-slate-500">
                            {event.actor.name}{' '}
                            <span className="text-slate-400">
                              @{event.actor.username}
                            </span>
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </div>
        </div>
      </div>
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
            const action = confirmAction;
            setConfirmAction(null);
            void mutate(
              { intent: 'bill-status', status: action },
              {
                fallback: t(
                  action === 'archive'
                    ? 'toast.billArchiveFailed'
                    : 'toast.billRestoreFailed',
                ),
                success: t(
                  action === 'archive'
                    ? 'toast.billArchived'
                    : 'toast.billRestored',
                ),
              },
            );
          }}
          onCancel={() => setConfirmAction(null)}
          t={t}
        />
      )}
      {pendingPayment && (
        <ConfirmDialog
          title="Confirm payment status"
          message={`Change this payment from ${pendingPayment.current} to ${pendingPayment.current === 'PAID' ? 'WAITING' : 'PAID'}? This change is audited.`}
          onConfirm={() => {
            const pending = pendingPayment;
            setPendingPayment(null);
            void mutate(
              {
                intent: 'payment',
                memberId: pending.memberId,
                expectedStatus: pending.current,
                status: pending.current === 'PAID' ? 'WAITING' : 'PAID',
              },
              {
                fallback: t('toast.paymentUpdateFailed'),
                success: t('toast.paymentUpdated'),
              },
            );
          }}
          onCancel={() => setPendingPayment(null)}
          t={t}
        />
      )}
    </>
  );
}
