import { ChevronRight, Plus, X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import CurrencyInput from 'react-currency-input-field';
import {
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router';

import {
  AdjustmentAllocation,
  AdjustmentType,
  calculateBillSplit,
  todayInHoChiMinh,
} from '@ff-restaurent/shared';

import { useAppContext } from '@/app/providers/app-context';
import { useI18n } from '@/app/providers/i18n';
import AmountInput from '@/components/ui/AmountInput';
import BackButton from '@/components/ui/BackButton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import DatePicker from '@/components/ui/DatePicker';
import Dropdown from '@/components/ui/Dropdown';
import ImagePreviewDialog from '@/components/ui/ImagePreviewDialog';
import SummaryLine from '@/components/ui/SummaryLine';
import {
  billDetailPath,
  billsReturnPath,
} from '@/features/bills/bill-navigation';
import { usePaymentQrImages } from '@/features/profile/profile-media.queries';
import { useRouteMutation } from '@/hooks/useRouteMutation';
import { money } from '@/lib/currency';
import { canChef } from '@/lib/permissions';
import { uniqueUsers } from '@/lib/user-display';

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

/**
 * CreateBillPage displays forms to create a new bill or edit an existing one.
 * Serves both /bills/new and /bills/:billId/edit.
 */
export default function CreateBillPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { billId } = useParams();
  const { user, users, bills, restaurants, participantGroups } =
    useAppContext();
  const { t } = useI18n();

  const editBill = billId
    ? bills.find((candidate) => candidate.id === billId)
    : undefined;
  const isEditing = !!editBill;
  const members = uniqueUsers(
    users.filter((candidate) => candidate.accountStatus !== 'BLOCKED'),
    user,
  );
  const activeMemberIds = new Set(members.map((member) => member.id));
  const usersById = new Map(users.map((member) => [member.id, member]));
  const historicalParticipantMembers =
    editBill?.participants.map(
      (participant) =>
        usersById.get(participant.memberId) ?? participant.member,
    ) ?? [];
  const billsReturnTo = billsReturnPath(null, searchParams.get('returnTo'));

  const [restaurantId, setRestaurantId] = useState(
    editBill?.restaurant?.id ?? '',
  );
  const [occurredOn, setOccurredOn] = useState(
    editBill?.occurredOn ?? todayInHoChiMinh(),
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
  const [adjustmentAllocation, setAdjustmentAllocation] =
    useState<AdjustmentAllocation>(
      (editBill?.adjustmentAllocation as AdjustmentAllocation | undefined) ??
        AdjustmentAllocation.PROPORTIONAL,
    );
  const [paymentQrImageId, setPaymentQrImageId] = useState(
    editBill?.paymentQrImageId ?? editBill?.paymentQrImage?.id ?? '',
  );
  const [participants, setParticipants] = useState<ParticipantDraft[]>(
    editBill?.participants?.map((p) => ({
      memberId: p.memberId,
      originCost: p.originCost,
    })) ?? [],
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [duplicateDetected, setDuplicateDetected] = useState(false);
  const [qrPreviewOpen, setQrPreviewOpen] = useState(false);
  const { mutate } = useRouteMutation();
  const paymentQrImagesQuery = usePaymentQrImages(
    canChef(user),
    user.id,
    isEditing ? editBill?.id : undefined,
  );
  const paymentQrImages = paymentQrImagesQuery.data ?? [];
  const activeRestaurants = restaurants.filter(
    (entry) => entry.status === 'ACTIVE' || entry.id === restaurantId,
  );
  const participantIds = new Set(participants.map((p) => p.memberId));
  const participantMembers = new Map(
    [...members, ...historicalParticipantMembers].map((member) => [
      member.id,
      member,
    ]),
  );
  const participantOptions = [
    ...members,
    ...historicalParticipantMembers.filter(
      (member) =>
        participantIds.has(member.id) && !activeMemberIds.has(member.id),
    ),
  ];
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
        adjustmentAllocation,
        participants,
      });
    } catch (error) {
      return error instanceof Error ? error : null;
    }
  }, [
    adjustmentAllocation,
    discounts,
    participants,
    shippingFee,
    totalBase,
    vat,
    vouchers,
  ]);
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
    occurredOn.length > 0 &&
    participants.length >= 2 &&
    participants.every((participant) => participant.originCost > 0) &&
    totalBase > 0 &&
    adjustmentsAreValid &&
    !calculationError;

  if (!canChef(user)) return <Navigate to="/bills" replace />;
  if (billId && !editBill) return <Navigate to="/bills" replace />;

  const onBack = () =>
    navigate(
      isEditing && billId ? billDetailPath(billId, billsReturnTo) : '/bills',
    );

  const updateParticipant = (memberId: string, originCost: number) => {
    setParticipants((current) =>
      current.map((p) =>
        p.memberId === memberId
          ? { ...p, originCost: Math.max(0, originCost) }
          : p,
      ),
    );
  };

  const submitBill = (allowDuplicate: boolean) => {
    const payload = {
      restaurantId,
      occurredOn,
      baseCost: totalBase,
      vat,
      shippingFee,
      discounts,
      vouchers,
      adjustmentAllocation,
      paymentQrImageId: paymentQrImageId || null,
      participants: participants.map((p) => ({
        memberId: p.memberId,
        originCost: p.originCost,
      })),
      allowDuplicate,
    };

    void mutate(
      {
        intent: isEditing ? 'update-bill' : 'create-bill',
        payload,
        ...(isEditing ? { billsReturnTo } : {}),
      },
      {
        fallback: t(
          isEditing ? 'toast.billUpdateFailed' : 'toast.billCreateFailed',
        ),
        success: t(isEditing ? 'toast.billUpdated' : 'toast.billCreated'),
        redirects: true,
        onError: (code) => {
          if (code === 'BILL_DUPLICATE_DETECTED') setDuplicateDetected(true);
        },
      },
    );
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    if (participants.length < 2) {
      setLocalError('A bill requires at least two participants.');
      return;
    }
    if (!occurredOn) {
      setLocalError(t('createBill.occurredOnRequired'));
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

    submitBill(false);
  };

  const applyGroup = () => {
    const group = participantGroups.find(({ id }) => id === selectedGroupId);
    if (!group) return;
    setParticipants((current) =>
      group.members
        .filter(({ userId }) => activeMemberIds.has(userId))
        .map(({ userId }) =>
          current.find(({ memberId }) => memberId === userId)
            ? { ...current.find(({ memberId }) => memberId === userId)! }
            : { memberId: userId, originCost: 0 },
        ),
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] py-2">
      <BackButton onClick={onBack} label={t('bills.backToBills')} />

      <form
        className="grid gap-5 xl:grid-cols-[1.05fr_1.1fr_0.85fr]"
        onSubmit={submit}
      >
        <div className="xl:col-span-3">
          <h2 className="mb-1 text-xl font-bold text-ink">
            {isEditing ? t('bills.editBill') : t('createBill.title')}
          </h2>
          <p className="text-compact text-slate-500">
            {t('createBill.subtitle')}
          </p>
          {localError && (
            <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {localError}
            </div>
          )}
        </div>

        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
          <div>
            <div className="mb-5 border-b border-border py-3">
              <h3 className="text-sm font-bold text-ink">Information</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Restaurant, fees, discounts, and vouchers
              </p>
            </div>

            <div className="relative mb-5 space-y-1.5">
              <span className="label">{t('createBill.restaurant')}</span>
              <Dropdown
                fullWidth
                label={t('createBill.restaurant')}
                ariaLabel={t('createBill.restaurant')}
                value={restaurantId}
                onChange={setRestaurantId}
                options={activeRestaurants.map((restaurant) => ({
                  value: restaurant.id,
                  label: restaurant.name,
                  description: `${restaurant.type} · ${restaurant.cuisineType}`,
                  searchText: `${restaurant.name} ${restaurant.type} ${restaurant.cuisineType}`,
                }))}
                searchable
                searchPlaceholder="Search restaurants or eateries…"
                emptyMessage={t('bills.noFilterResults')}
              />
            </div>

            <label className="mb-5 block space-y-1.5">
              <span className="label">{t('createBill.occurredOn')}</span>
              <DatePicker value={occurredOn} onChange={setOccurredOn} />
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

            <div className="mb-6 space-y-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <span className="label">
                  {t('createBill.adjustmentAllocation')}
                </span>
                <div className="mt-2">
                  <Dropdown
                    label={t('createBill.adjustmentAllocation')}
                    ariaLabel={t('createBill.adjustmentAllocation')}
                    value={adjustmentAllocation}
                    onChange={(value) =>
                      setAdjustmentAllocation(value as AdjustmentAllocation)
                    }
                    options={[
                      {
                        value: AdjustmentAllocation.PROPORTIONAL,
                        label: t('createBill.allocationProportional'),
                        description: t('createBill.allocationProportionalHint'),
                      },
                      {
                        value: AdjustmentAllocation.EQUAL,
                        label: t('createBill.allocationEqual'),
                        description: t('createBill.allocationEqualHint'),
                      },
                    ]}
                  />
                </div>
              </div>
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
                  <Dropdown
                    label="Discount type"
                    ariaLabel={`Discount ${index + 1} type`}
                    value={discount.type}
                    onChange={(value) =>
                      setDiscounts((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                type: value as AdjustmentType,
                                value: 0,
                              }
                            : item,
                        ),
                      )
                    }
                    options={[
                      { value: AdjustmentType.FIXED, label: 'Fixed' },
                      { value: AdjustmentType.PERCENTAGE, label: 'Percent' },
                    ]}
                  />
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
                    aria-label={`Discount ${index + 1} value`}
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
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
          <div>
            <div className="mb-5 border-b border-border py-3">
              <h3 className="text-sm font-bold text-ink">Participants</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Payment destination, members, and their base amounts
              </p>
            </div>

            <div className="mb-6 space-y-2">
              <span className="label">{t('bills.paymentQr')}</span>
              <Dropdown
                label={
                  paymentQrImagesQuery.isPending
                    ? t('common.loading')
                    : 'No payment QR'
                }
                ariaLabel={t('bills.paymentQr')}
                value={paymentQrImageId}
                onChange={setPaymentQrImageId}
                options={paymentQrImages.map((qr) => ({
                  value: qr.id,
                  label: qr.label,
                  icon: (
                    <img
                      src={qr.imageUrl}
                      alt=""
                      className="h-4 w-4 rounded-sm object-contain"
                    />
                  ),
                }))}
                allowClear
              />
              {paymentQrImagesQuery.isError && (
                <button
                  type="button"
                  className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                  onClick={() => void paymentQrImagesQuery.refetch()}
                >
                  {t('common.retry')}
                </button>
              )}
              {paymentQrImageId &&
                (() => {
                  const selectedQr = paymentQrImages.find(
                    (qr) => qr.id === paymentQrImageId,
                  );
                  const selectedQrUrl =
                    selectedQr?.imageUrl ?? editBill?.paymentQrImage?.imageUrl;
                  const selectedQrLabel =
                    selectedQr?.label ??
                    editBill?.paymentQrImage?.label ??
                    t('createBill.selectedPaymentQr');
                  return (
                    <>
                      <button
                        type="button"
                        className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
                        onClick={() => setQrPreviewOpen(true)}
                      >
                        <img
                          src={selectedQrUrl}
                          alt={t('createBill.selectedPaymentQr')}
                          className="h-32 w-32 rounded-lg border border-border bg-white object-contain p-2"
                        />
                      </button>
                      <ImagePreviewDialog
                        open={qrPreviewOpen}
                        onClose={() => setQrPreviewOpen(false)}
                        src={selectedQrUrl}
                        title={selectedQrLabel}
                        alt={t('createBill.selectedPaymentQr')}
                        onRetry={() => {
                          void paymentQrImagesQuery.refetch();
                        }}
                        isSignedUrl
                        imageClassName="bg-white p-3"
                      />
                    </>
                  );
                })()}
              {!paymentQrImageId && editBill?.paymentUrl && (
                <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  This bill keeps its legacy payment link as read-only until a
                  QR image is selected.
                </p>
              )}
            </div>

            <div className="mb-6">
              <div className="mb-5 rounded-lg border border-border bg-muted/30 p-3">
                <span className="label">{t('groups.title')}</span>
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Dropdown
                    label={t('groups.choose')}
                    ariaLabel={t('groups.choose')}
                    value={selectedGroupId}
                    onChange={setSelectedGroupId}
                    options={participantGroups.map((group) => ({
                      value: group.id,
                      label: group.name,
                      description: `${group.members.length} ${t('groups.members')}`,
                    }))}
                    searchable
                    searchPlaceholder={t('groups.search')}
                    emptyMessage={t('groups.empty')}
                    allowClear
                    clearLabel={t('bills.clearAll')}
                  />
                  <button
                    type="button"
                    className="btn btn-soft"
                    disabled={!selectedGroupId}
                    onClick={applyGroup}
                  >
                    {t('groups.apply')}
                  </button>
                </div>
              </div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="label">{t('createBill.participants')}</span>
                <span className="text-xs text-slate-500">
                  {t('createBill.baseTotal')}:{' '}
                  <span className="font-semibold text-ink">
                    {totalBase > 0 ? money(totalBase) : '-'}
                  </span>
                </span>
              </div>

              <div className="mb-3 flex flex-col gap-2">
                {participants.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border py-3 text-center text-compact text-slate-400">
                    {t('createBill.addMembers')}
                  </p>
                )}
                {participants.map((participant) => {
                  const member = participantMembers.get(participant.memberId);
                  if (!member) return null;
                  const memberLabel = activeMemberIds.has(member.id)
                    ? member.name
                    : `${member.name} (${t('createBill.blockedParticipant')})`;
                  const calculated = calculatedPreview?.participants.find(
                    (item) => item.memberId === participant.memberId,
                  );
                  return (
                    <div
                      key={participant.memberId}
                      className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-compact font-semibold text-ink">
                          {memberLabel}
                        </p>
                        {calculated && (
                          <p className="mt-0.5 text-2xs text-slate-500">
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
                          aria-label={`Base amount for ${memberLabel}`}
                          className="h-9 w-32 rounded-md border border-border bg-surface px-3 text-right text-sm text-ink outline-none transition-colors focus:border-ink"
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

              {members.length > 0 && (
                <div className="relative">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Add participant
                  </span>
                  <Dropdown
                    multiple
                    fullWidth
                    label="Add participant"
                    ariaLabel="Add participant"
                    values={participants.map(
                      (participant) => participant.memberId,
                    )}
                    onChange={(memberIds) =>
                      setParticipants((current) =>
                        memberIds.map(
                          (memberId) =>
                            current.find(
                              (participant) =>
                                participant.memberId === memberId,
                            ) ?? { memberId, originCost: 0 },
                        ),
                      )
                    }
                    options={participantOptions.map((member) => ({
                      value: member.id,
                      label: activeMemberIds.has(member.id)
                        ? member.name
                        : `${member.name} (${t('createBill.blockedParticipant')})`,
                      description: `@${member.username}`,
                      searchText: `${member.name} ${member.username}`,
                    }))}
                    searchable
                    searchPlaceholder="Search by full name or username…"
                    emptyMessage={t('bills.noFilterResults')}
                    formatSelection={(selected) =>
                      `${selected.length} member${selected.length === 1 ? '' : 's'} selected`
                    }
                  />
                  <p className="mt-1.5 text-2xs text-slate-500">
                    {availableMembers.length} member
                    {availableMembers.length === 1 ? '' : 's'} available
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
          <div>
            <div className="mb-3 border-b border-border py-3">
              <h3 className="text-sm font-bold text-ink">Preview</h3>
              <p className="mt-0.5 text-xs text-slate-500">
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
                <span className="text-compact font-bold text-ink">
                  {t('createBill.grandTotal')}
                </span>
                <span className="text-lg font-bold text-ink">
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
              className="btn btn-primary h-11 w-full"
              disabled={!isFormReady}
            >
              {t('createBill.submit')} <ChevronRight size={16} />
            </button>
            {!isFormReady && (
              <p className="mt-2 text-center text-2xs leading-relaxed text-slate-500">
                Select a restaurant, add at least two members, and enter every
                base amount to create the bill.
              </p>
            )}
          </div>
        </section>
      </form>
      {duplicateDetected && (
        <ConfirmDialog
          title={t('duplicate.title')}
          message={t('duplicate.message')}
          onCancel={() => setDuplicateDetected(false)}
          onConfirm={() => {
            setDuplicateDetected(false);
            submitBill(true);
          }}
        />
      )}
    </div>
  );
}
