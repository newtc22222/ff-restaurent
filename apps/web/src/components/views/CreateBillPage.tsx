import { FormEvent, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ChevronRight, Plus } from 'lucide-react';
import CurrencyInput from 'react-currency-input-field';
import { AdjustmentType, calculateBillSplit } from '@ff-restaurent/shared';
import type { ApiClient, Bill, User, RestaurantEntry } from '../../api.js';
import { money } from '../../api.js';
import type { Locale } from '../../i18n.js';
import type { Theme } from '../../theme.js';
import AppHeader from '../layout/AppHeader.js';
import AmountInput from '../ui/AmountInput.js';
import SummaryLine from '../ui/SummaryLine.js';

interface ParticipantDraft {
  memberId: string;
  originCost: number;
}

interface DiscountDraft {
  type: AdjustmentType;
  value: number;
  label: string;
}

interface VoucherDraft {
  code: string;
  value: number;
}

interface CreateBillPageProps {
  /**
   * The API client instance.
   */
  api: ApiClient;
  /**
   * The current logged-in user.
   */
  user: User;
  /**
   * List of team members.
   */
  members: User[];
  /**
   * List of available restaurants.
   */
  restaurants: RestaurantEntry[];
  /**
   * Function to refresh application data.
   */
  refresh: () => Promise<void>;
  /**
   * Action trigger to go back to dashboard.
   */
  onBack: () => void;
  /**
   * Action trigger to sign out.
   */
  onSignOut: () => void;
  /**
   * Function to update global error state.
   */
  setError: (error: string | null) => void;
  /**
   * Translation utility function.
   */
  t: (key: string) => string;
  /**
   * Current active locale.
   */
  locale: Locale;
  /**
   * Callback to set locale.
   */
  setLocale: (locale: Locale) => void;
  /**
   * Current active theme.
   */
  theme: Theme;
  /**
   * Callback to set theme.
   */
  setTheme: (theme: Theme) => void;
  /**
   * Optional bill to edit (if in edit mode).
   */
  editBill?: Bill;
}

/**
 * CreateBillPage displays forms to create a new bill or edit an existing one.
 */
export default function CreateBillPage({
  api,
  user,
  members,
  restaurants,
  refresh,
  onBack,
  onSignOut,
  setError,
  t,
  locale,
  setLocale,
  theme,
  setTheme,
  editBill,
}: CreateBillPageProps) {
  const isEditing = !!editBill;
  const [restaurantId, setRestaurantId] = useState(
    editBill?.restaurant?.id ?? '',
  );
  const [vat, setVat] = useState(editBill?.vat ?? 30000);
  const [shippingFee, setShippingFee] = useState(
    editBill?.shippingFee ?? 20000,
  );
  const [discounts, setDiscounts] = useState<DiscountDraft[]>(
    editBill?.discounts.map((discount) => ({
      type: discount.type as AdjustmentType,
      value: discount.value,
      label: discount.label ?? '',
    })) ?? [],
  );
  const [vouchers, setVouchers] = useState<VoucherDraft[]>(
    editBill?.vouchers ?? [],
  );
  const [paymentUrl, setPaymentUrl] = useState(editBill?.paymentUrl ?? '');
  const [participants, setParticipants] = useState<ParticipantDraft[]>(
    editBill?.participants?.map((p) => ({
      memberId: p.memberId,
      originCost: p.originCost,
    })) ?? [],
  );
  const [submitted, setSubmitted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const activeRestaurants = restaurants.filter(
    (entry) => entry.status === 'ACTIVE' || entry.id === restaurantId,
  );
  const participantIds = new Set(participants.map((p) => p.memberId));
  const availableMembers = members.filter((m) => !participantIds.has(m.id));
  const totalBase = participants.reduce((sum, p) => sum + p.originCost, 0);
  const preview = useMemo(() => {
    if (participants.length < 2 || totalBase <= 0) return null;
    try {
      return calculateBillSplit({
        baseCost: totalBase,
        vat,
        shippingFee,
        discounts,
        vouchers,
        participants,
      });
    } catch (error) {
      return error instanceof Error ? error : null;
    }
  }, [discounts, participants, shippingFee, totalBase, vat, vouchers]);
  const calculationError = preview instanceof Error ? preview.message : null;
  const calculatedPreview = preview instanceof Error ? null : preview;
  const grandTotal =
    calculatedPreview?.totalCost ?? totalBase + vat + shippingFee;

  const updateParticipant = (memberId: string, originCost: number) => {
    setParticipants((current) =>
      current.map((p) =>
        p.memberId === memberId
          ? { ...p, originCost: Math.max(0, originCost) }
          : p,
      ),
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    setError(null);
    if (participants.length < 2) {
      setLocalError('A bill requires at least two participants.');
      return;
    }
    if (totalBase <= 0) {
      setLocalError('Participant base amounts must be greater than zero.');
      return;
    }
    if (calculationError) {
      setLocalError(calculationError);
      return;
    }

    const payload = {
      restaurantId,
      baseCost: totalBase,
      vat,
      shippingFee,
      discounts,
      vouchers,
      paymentUrl: paymentUrl || undefined,
      participants: participants.map((p) => ({
        memberId: p.memberId,
        originCost: p.originCost,
      })),
    };

    try {
      if (isEditing) {
        await api.request(`/bills/${editBill.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await api.request('/bills', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setSubmitted(true);
      await refresh();
      window.setTimeout(onBack, 600);
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : isEditing
            ? 'Could not update bill'
            : 'Could not create bill',
      );
    }
  };

  return (
    <div className="min-h-screen bg-bg font-sans text-ink">
      <AppHeader
        user={user}
        onSignOut={onSignOut}
        t={t}
        locale={locale}
        setLocale={setLocale}
        theme={theme}
        setTheme={setTheme}
        onProfile={onBack}
      />
      <main className="mx-auto max-w-xl px-4 py-8">
        <button
          className="mb-6 flex items-center gap-1.5 text-[13px] text-slate-500 transition-colors hover:text-ink"
          onClick={onBack}
        >
          <ArrowLeft size={14} /> {t('bills.backToBills')}
        </button>

        <form
          className="rounded-xl border border-border bg-surface p-6 shadow-sm"
          onSubmit={submit}
        >
          <h2 className="mb-1 text-[20px] font-bold text-ink">
            {isEditing ? t('bills.editBill') : t('createBill.title')}
          </h2>
          <p className="mb-6 text-[13px] text-slate-500">
            {t('createBill.subtitle')}
          </p>

          {localError && (
            <div className="mb-5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {localError}
            </div>
          )}

          <label className="mb-5 block space-y-1.5">
            <span className="label">{t('createBill.restaurant')}</span>
            <select
              className="field w-full"
              value={restaurantId}
              onChange={(event) => setRestaurantId(event.target.value)}
              required
            >
              <option value="">{t('createBill.choose')}</option>
              {activeRestaurants.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>

          <div className="mb-6 grid grid-cols-2 gap-3">
            <AmountInput
              label={t('createBill.vat')}
              value={vat}
              onChange={setVat}
            />
            <AmountInput
              label={t('createBill.shipping')}
              value={shippingFee}
              onChange={setShippingFee}
            />
          </div>

          <label className="mb-6 block space-y-1.5">
            <span className="label">Payment link (HTTPS)</span>
            <input
              className="field w-full"
              type="url"
              value={paymentUrl}
              onChange={(event) => setPaymentUrl(event.target.value)}
              placeholder="https://pay.example.com/..."
              pattern="https://.*"
            />
          </label>

          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="label">Discounts</span>
              <button
                type="button"
                className="btn btn-soft h-8 px-3 text-xs"
                onClick={() =>
                  setDiscounts((current) => [
                    ...current,
                    { type: AdjustmentType.FIXED, value: 0, label: '' },
                  ])
                }
              >
                <Plus size={12} /> Add discount
              </button>
            </div>
            {discounts.map((discount, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[8rem_1fr_8rem_auto]"
              >
                <select
                  className="field"
                  value={discount.type}
                  onChange={(event) =>
                    setDiscounts((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              type: event.target.value as AdjustmentType,
                            }
                          : item,
                      ),
                    )
                  }
                >
                  <option value={AdjustmentType.FIXED}>Fixed</option>
                  <option value={AdjustmentType.PERCENTAGE}>Percent</option>
                </select>
                <input
                  className="field"
                  value={discount.label}
                  placeholder="Label"
                  onChange={(event) =>
                    setDiscounts((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, label: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <input
                  className="field text-right"
                  type="number"
                  min="0"
                  step={discount.type === AdjustmentType.FIXED ? 1 : 0.01}
                  value={discount.value}
                  onChange={(event) =>
                    setDiscounts((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, value: Number(event.target.value) }
                          : item,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="px-2 text-red-500"
                  onClick={() =>
                    setDiscounts((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="label">Vouchers</span>
              <button
                type="button"
                className="btn btn-soft h-8 px-3 text-xs"
                onClick={() =>
                  setVouchers((current) => [...current, { code: '', value: 0 }])
                }
              >
                <Plus size={12} /> Add voucher
              </button>
            </div>
            {vouchers.map((voucher, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_8rem_auto] gap-2 rounded-lg border border-border p-3"
              >
                <input
                  className="field"
                  value={voucher.code}
                  placeholder="Voucher code"
                  required
                  onChange={(event) =>
                    setVouchers((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, code: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <input
                  className="field text-right"
                  type="number"
                  min="0"
                  step="1"
                  value={voucher.value}
                  onChange={(event) =>
                    setVouchers((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, value: Number(event.target.value) }
                          : item,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="px-2 text-red-500"
                  onClick={() =>
                    setVouchers((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="label">{t('createBill.participants')}</span>
              <span className="text-[12px] text-slate-500">
                {t('createBill.baseTotal')}:{' '}
                <span className="font-semibold text-ink">
                  {totalBase > 0 ? money(totalBase) : '-'}
                </span>
              </span>
            </div>

            <div className="mb-3 flex flex-col gap-2">
              {participants.length === 0 && (
                <p className="rounded-lg border border-dashed border-border py-3 text-center text-[13px] text-slate-400">
                  {t('createBill.addMembers')}
                </p>
              )}
              {participants.map((participant) => {
                const member = members.find(
                  (candidate) => candidate.id === participant.memberId,
                );
                if (!member) return null;
                const calculated = calculatedPreview?.participants.find(
                  (item) => item.memberId === participant.memberId,
                );
                return (
                  <div
                    key={participant.memberId}
                    className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink">
                        {member.name}
                      </p>
                      {calculated && (
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {money(calculated.finalPrice)} = base{' '}
                          {money(calculated.originCost)} + VAT{' '}
                          {money(calculated.allocatedVat)} + ship{' '}
                          {money(calculated.allocatedShipping)} − adjustments{' '}
                          {money(calculated.discountApplied)}
                        </p>
                      )}
                    </div>
                    <div className="relative">
                      <CurrencyInput
                        aria-label={`Base amount for ${member.name}`}
                        className="h-9 w-32 rounded-md border border-border bg-surface px-3 text-right text-[14px] text-ink outline-none transition-colors focus:border-ink"
                        value={
                          participant.originCost === 0
                            ? ''
                            : participant.originCost
                        }
                        onValueChange={(val, name, values) =>
                          updateParticipant(
                            participant.memberId,
                            values?.float ?? 0,
                          )
                        }
                        allowDecimals={false}
                        allowNegativeValue={false}
                        intlConfig={{ locale: 'vi-VN', currency: 'VND' }}
                      />
                    </div>
                    <button
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-all hover:bg-red-50 hover:text-red-500"
                      type="button"
                      onClick={() =>
                        setParticipants((current) =>
                          current.filter(
                            (row) => row.memberId !== participant.memberId,
                          ),
                        )
                      }
                      title={t('common.remove')}
                    >
                      x
                    </button>
                  </div>
                );
              })}
            </div>

            {availableMembers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {availableMembers.map((member) => (
                  <button
                    key={member.id}
                    className="flex h-8 items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 text-[12px] font-semibold text-slate-500 transition-all hover:border-ink hover:text-ink dark:border-slate-600"
                    type="button"
                    onClick={() =>
                      setParticipants((current) => [
                        ...current,
                        { memberId: member.id, originCost: 0 },
                      ])
                    }
                  >
                    <Plus size={11} /> {member.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {(grandTotal > 0 || participants.length > 0) && (
            <div className="mb-5 rounded-lg bg-muted/50 p-4">
              <SummaryLine
                label={t('createBill.base')}
                value={money(totalBase)}
              />
              {vat > 0 && (
                <SummaryLine label={t('createBill.vat')} value={money(vat)} />
              )}
              {shippingFee > 0 && (
                <SummaryLine
                  label={`${t('createBill.shipping')}${participants.length > 0 ? ` / ${participants.length}` : ''}`}
                  value={money(shippingFee)}
                />
              )}
              {(calculatedPreview?.totalAdjustment ?? 0) > 0 && (
                <SummaryLine
                  label="Discounts & vouchers"
                  value={`-${money(calculatedPreview?.totalAdjustment ?? 0)}`}
                  tone="success"
                />
              )}
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <span className="text-[13px] font-bold text-ink">
                  {t('createBill.grandTotal')}
                </span>
                <span className="text-[18px] font-bold text-ink">
                  {money(grandTotal)}
                </span>
              </div>
              {calculationError && (
                <p className="mt-2 text-xs font-medium text-red-600">
                  {calculationError}
                </p>
              )}
              {calculatedPreview && (
                <p className="mt-2 text-xs text-emerald-600">
                  Reconciled: participant shares total{' '}
                  {money(calculatedPreview.totalCost)}. Remainders are assigned
                  deterministically by member ID.
                </p>
              )}
            </div>
          )}

          <button
            className={`btn h-11 w-full ${submitted ? 'bg-emerald-500 text-white' : 'btn-primary'}`}
            disabled={submitted}
          >
            {submitted ? (
              <>
                <CheckCircle2 size={16} /> {t('createBill.created')}
              </>
            ) : (
              <>
                {t('createBill.submit')} <ChevronRight size={16} />
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
