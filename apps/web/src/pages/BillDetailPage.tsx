import { useState } from 'react';
import { CheckCircle2, Clock, Edit3, ExternalLink } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { money } from '../lib/api';
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

/**
 * BillDetailPage displays a breakdown of a single bill including participant costs and payment buttons.
 */
export default function BillDetailPage() {
  const navigate = useNavigate();
  const { billId } = useParams();
  const { user, bills, setError } = useAppContext();
  const { t } = useI18n();
  const { mutate } = useMutation(setError);
  const [confirmAction, setConfirmAction] = useState<
    'archive' | 'restore' | null
  >(null);
  const [pendingPayment, setPendingPayment] = useState<{
    memberId: string;
    current: 'PAID' | 'WAITING';
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  return (
    <>
      <div className="mx-auto w-full max-w-2xl py-2">
        <BackButton onClick={onBack} label={t('bills.backToBills')} />

        <section className="mb-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-[22px] font-bold text-ink">
                {bill.restaurant.name}
              </h2>
              <p className="mt-0.5 text-[13px] text-slate-500">
                {bill.restaurant.type} / {bill.restaurant.cuisineType} / created
                by {bill.createdBy.name}
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

        {notice && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            {notice}
          </div>
        )}

        {bill.paymentUrl && (
          <a
            className="btn btn-primary mb-4 w-full"
            href={bill.paymentUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open secure payment link <ExternalLink size={14} />
          </a>
        )}

        {(bill.discounts.length > 0 || bill.vouchers.length > 0) && (
          <section className="mb-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
            <h3 className="label mb-3">Adjustments</h3>
            <div className="space-y-2 text-sm">
              {bill.discounts.map((discount, index) => (
                <div key={`discount-${index}`} className="flex justify-between">
                  <span>
                    {discount.label || `Discount ${index + 1}`} ({discount.type}
                    )
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
          <section className="mb-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
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

        {canManage && canChef(user) && (
          <div className="mb-4 flex gap-3">
            <button
              className="btn btn-soft flex-1"
              onClick={() => navigate(`/bills/${bill.id}/edit`)}
            >
              <Edit3 size={14} /> {t('bills.editBill')}
            </button>
          </div>
        )}

        <section className="mb-4 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
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
                    disabled={participant.paymentStatus === 'PAID'}
                    onClick={() =>
                      setPendingPayment({
                        memberId: participant.memberId,
                        current: participant.paymentStatus,
                      })
                    }
                  >
                    {participant.paymentStatus === 'WAITING'
                      ? t('bills.markPaid')
                      : 'Done'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </section>

        {canManage && canChef(user) && (
          <div className="flex gap-3">
            <button
              className="btn btn-soft flex-1"
              disabled={allPaid}
              title={allPaid ? 'All members have paid' : undefined}
              onClick={() =>
                void mutate(
                  { intent: 'bill-reminders' },
                  {
                    fallback: 'Could not send reminders',
                    onSuccess: () => setNotice('Payment reminders processed.'),
                  },
                )
              }
            >
              {t('bills.sendReminders')}
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
              { fallback: `Could not ${action} bill` },
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
              { fallback: 'Could not update payment status' },
            );
          }}
          onCancel={() => setPendingPayment(null)}
          t={t}
        />
      )}
    </>
  );
}
