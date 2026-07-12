import { FormEvent, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Plus,
  Search,
  UserPlus,
  X,
} from 'lucide-react';
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
  const [vat, setVat] = useState(editBill?.vat ?? 0);
  const [shippingFee, setShippingFee] = useState(
    editBill?.shippingFee ?? 22000,
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
  const [memberSearch, setMemberSearch] = useState('');
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [restaurantSearch, setRestaurantSearch] = useState(
    editBill?.restaurant?.name ?? '',
  );
  const [restaurantPickerOpen, setRestaurantPickerOpen] = useState(false);

  const activeRestaurants = restaurants.filter(
    (entry) => entry.status === 'ACTIVE' || entry.id === restaurantId,
  );
  const normalizedRestaurantSearch = restaurantSearch
    .trim()
    .toLocaleLowerCase();
  const filteredRestaurants = activeRestaurants.filter((restaurant) =>
    `${restaurant.name} ${restaurant.type} ${restaurant.cuisineType}`
      .toLocaleLowerCase()
      .includes(normalizedRestaurantSearch),
  );
  const participantIds = new Set(participants.map((p) => p.memberId));
  const availableMembers = members.filter((m) => !participantIds.has(m.id));
  const normalizedMemberSearch = memberSearch.trim().toLocaleLowerCase();
  const filteredMembers = availableMembers.filter((member) =>
    `${member.name} ${member.username}`
      .toLocaleLowerCase()
      .includes(normalizedMemberSearch),
  );
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
  const adjustmentsAreValid =
    discounts.every((discount) => discount.value > 0) &&
    vouchers.every(
      (voucher) => voucher.code.trim().length > 0 && voucher.value > 0,
    );
  const isFormReady =
    restaurantId.length > 0 &&
    participants.length >= 2 &&
    participants.every((participant) => participant.originCost > 0) &&
    totalBase > 0 &&
    adjustmentsAreValid &&
    !calculationError;

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
    if (participants.some((participant) => participant.originCost <= 0)) {
      setLocalError('Enter a base amount for every participant.');
      return;
    }
    if (!adjustmentsAreValid) {
      setLocalError('Complete or remove every discount and voucher.');
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
    <div className="flex h-screen flex-col overflow-hidden bg-bg font-sans text-ink">
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
      <main className="mx-auto min-h-0 w-full max-w-[1500px] flex-1 overflow-y-auto px-4 py-8 xl:flex xl:flex-col xl:overflow-hidden">
        <button
          className="mb-6 flex items-center gap-1.5 text-[13px] text-slate-500 transition-colors hover:text-ink"
          onClick={onBack}
        >
          <ArrowLeft size={14} /> {t('bills.backToBills')}
        </button>

        <form
          className="grid gap-5 xl:min-h-0 xl:flex-1 xl:grid-cols-[1.05fr_1.1fr_0.85fr] xl:grid-rows-[auto_minmax(0,1fr)]"
          onSubmit={submit}
        >
          <div className="xl:col-span-3">
            <h2 className="mb-1 text-[20px] font-bold text-ink">
              {isEditing ? t('bills.editBill') : t('createBill.title')}
            </h2>
            <p className="text-[13px] text-slate-500">
              {t('createBill.subtitle')}
            </p>
            {localError && (
              <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {localError}
              </div>
            )}
          </div>

          <section className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6 xl:min-h-0 xl:overflow-y-auto">
            <div className="mb-5 border-b border-border pb-3">
              <h3 className="text-[15px] font-bold text-ink">Information</h3>
              <p className="mt-0.5 text-[12px] text-slate-500">
                Restaurant, fees, discounts, and vouchers
              </p>
            </div>

            <div className="relative mb-5 space-y-1.5">
              <label className="label" htmlFor="restaurant-search">
                {t('createBill.restaurant')}
              </label>
              <div className="relative">
                <input
                  id="restaurant-search"
                  className="field w-full pr-9"
                  value={restaurantSearch}
                  placeholder="Search restaurants or eateries…"
                  role="combobox"
                  aria-expanded={restaurantPickerOpen}
                  aria-controls="restaurant-options"
                  aria-autocomplete="list"
                  onFocus={() => setRestaurantPickerOpen(true)}
                  onBlur={() => setRestaurantPickerOpen(false)}
                  onChange={(event) => {
                    setRestaurantSearch(event.target.value);
                    setRestaurantId('');
                    setRestaurantPickerOpen(true);
                  }}
                />
                <Search
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
              </div>
              {restaurantPickerOpen && (
                <div
                  id="restaurant-options"
                  role="listbox"
                  className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-surface p-1.5 shadow-lg"
                >
                  {filteredRestaurants.length > 0 ? (
                    filteredRestaurants.map((restaurant) => (
                      <button
                        key={restaurant.id}
                        type="button"
                        role="option"
                        aria-selected={restaurant.id === restaurantId}
                        className="w-full rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted focus:bg-muted focus:outline-none"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setRestaurantId(restaurant.id);
                          setRestaurantSearch(restaurant.name);
                          setRestaurantPickerOpen(false);
                        }}
                      >
                        <span className="block truncate text-[13px] font-semibold text-ink">
                          {restaurant.name}
                        </span>
                        <span className="block truncate text-[11px] text-slate-500">
                          {restaurant.type} · {restaurant.cuisineType}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-6 text-center text-[13px] text-slate-500">
                      No restaurants match “{restaurantSearch}”.
                    </p>
                  )}
                </div>
              )}
            </div>

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

            <div className="mb-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="label">Discounts</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-ink"
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
                  className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-[9rem_minmax(0,1fr)_10rem_2.5rem] sm:items-end"
                >
                  <select
                    className="field w-full"
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
                    className="field w-full"
                    value={discount.label}
                    placeholder="e.g. Team promotion"
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
                  <CurrencyInput
                    className="field w-full text-right"
                    value={discount.value === 0 ? '' : discount.value}
                    allowDecimals={discount.type === AdjustmentType.PERCENTAGE}
                    decimalsLimit={2}
                    allowNegativeValue={false}
                    suffix={
                      discount.type === AdjustmentType.PERCENTAGE
                        ? '%'
                        : undefined
                    }
                    intlConfig={
                      discount.type === AdjustmentType.FIXED
                        ? { locale: 'vi-VN', currency: 'VND' }
                        : undefined
                    }
                    onValueChange={(_value, _name, values) =>
                      setDiscounts((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                value:
                                  discount.type === AdjustmentType.PERCENTAGE
                                    ? Math.min(values?.float ?? 0, 100)
                                    : (values?.float ?? 0),
                              }
                            : item,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                    aria-label={`Remove discount ${index + 1}`}
                    onClick={() =>
                      setDiscounts((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="mb-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="label">Vouchers</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-ink"
                  onClick={() =>
                    setVouchers((current) => [
                      ...current,
                      { code: '', value: 0 },
                    ])
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
                  <CurrencyInput
                    className="field text-right"
                    value={voucher.value === 0 ? '' : voucher.value}
                    allowDecimals={false}
                    allowNegativeValue={false}
                    intlConfig={{ locale: 'vi-VN', currency: 'VND' }}
                    onValueChange={(_value, _name, values) =>
                      setVouchers((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, value: values?.float ?? 0 }
                            : item,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                    aria-label={`Remove voucher ${index + 1}`}
                    onClick={() =>
                      setVouchers((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6 xl:min-h-0 xl:overflow-y-auto">
            <div className="mb-5 border-b border-border pb-3">
              <h3 className="text-[15px] font-bold text-ink">Participants</h3>
              <p className="mt-0.5 text-[12px] text-slate-500">
                Payment destination, members, and their base amounts
              </p>
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
                <div className="relative">
                  <label className="mb-1.5 block text-[12px] font-medium text-slate-600 dark:text-slate-300">
                    Add participant
                  </label>
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      size={16}
                    />
                    <input
                      className="field w-full pr-9"
                      value={memberSearch}
                      placeholder="Search by full name or username…"
                      role="combobox"
                      aria-expanded={memberPickerOpen}
                      aria-controls="available-member-options"
                      aria-autocomplete="list"
                      onFocus={() => setMemberPickerOpen(true)}
                      onBlur={() => setMemberPickerOpen(false)}
                      onChange={(event) => {
                        setMemberSearch(event.target.value);
                        setMemberPickerOpen(true);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') setMemberPickerOpen(false);
                        if (
                          event.key === 'Enter' &&
                          filteredMembers.length > 0
                        ) {
                          event.preventDefault();
                          const member = filteredMembers[0];
                          setParticipants((current) => [
                            ...current,
                            { memberId: member.id, originCost: 0 },
                          ]);
                          setMemberSearch('');
                        }
                      }}
                    />
                  </div>

                  {memberPickerOpen && (
                    <div
                      id="available-member-options"
                      role="listbox"
                      className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-surface p-1.5 shadow-lg"
                    >
                      {filteredMembers.length > 0 ? (
                        filteredMembers.map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            role="option"
                            aria-selected="false"
                            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted focus:bg-muted focus:outline-none"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setParticipants((current) => [
                                ...current,
                                { memberId: member.id, originCost: 0 },
                              ]);
                              setMemberSearch('');
                            }}
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-slate-600 dark:text-slate-300">
                              {member.name
                                .split(/\s+/)
                                .slice(0, 2)
                                .map((part) => part[0])
                                .join('')
                                .toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-semibold text-ink">
                                {member.name}
                              </span>
                              <span className="block truncate text-[11px] text-slate-500">
                                @{member.username}
                              </span>
                            </span>
                            <UserPlus
                              size={15}
                              className="shrink-0 text-slate-400"
                            />
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-6 text-center text-[13px] text-slate-500">
                          No members match “{memberSearch}”.
                        </p>
                      )}
                    </div>
                  )}
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    {availableMembers.length} member
                    {availableMembers.length === 1 ? '' : 's'} available
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6 xl:min-h-0 xl:overflow-y-auto">
            <div className="mb-5 border-b border-border pb-3">
              <h3 className="text-[15px] font-bold text-ink">Preview</h3>
              <p className="mt-0.5 text-[12px] text-slate-500">
                Total bill and submission readiness
              </p>
            </div>

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

            <button
              className={`btn h-11 w-full ${submitted ? 'bg-emerald-500 text-white' : 'btn-primary'}`}
              disabled={submitted || !isFormReady}
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
            {!isFormReady && !submitted && (
              <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500">
                Select a restaurant, add at least two members, and enter every
                base amount to create the bill.
              </p>
            )}
          </section>
        </form>
      </main>
    </div>
  );
}
