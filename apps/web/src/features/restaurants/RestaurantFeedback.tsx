import { MessageSquare, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useI18n } from '../../app/providers/i18n';
import { useMutation } from '../../hooks/useMutation';
import type { RestaurantFeedbackPage } from '../../lib/api';
import Dropdown from '../../components/ui/Dropdown';

const ratingOptions = Array.from({ length: 19 }, (_, index) => 1 + index / 2);

const formatRating = (rating: number | null) =>
  rating === null ? '—' : rating.toFixed(1);

export default function RestaurantFeedback({
  data,
}: {
  data: RestaurantFeedbackPage;
}) {
  const { locale, t } = useI18n();
  const { fetcher, mutate } = useMutation();
  const [selectedBillId, setSelectedBillId] = useState(
    data.eligibleBills[0]?.billId ?? '',
  );
  const selectedBill = useMemo(
    () =>
      data.eligibleBills.find(({ billId }) => billId === selectedBillId) ??
      data.eligibleBills[0],
    [data.eligibleBills, selectedBillId],
  );
  const [foodRating, setFoodRating] = useState(
    selectedBill?.feedback?.foodRating ?? 10,
  );
  const [serviceRating, setServiceRating] = useState(
    selectedBill?.feedback?.serviceRating ?? 10,
  );
  const [comment, setComment] = useState(selectedBill?.feedback?.comment ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!selectedBill && data.eligibleBills[0]) {
      setSelectedBillId(data.eligibleBills[0].billId);
    }
  }, [data.eligibleBills, selectedBill]);

  useEffect(() => {
    setFoodRating(selectedBill?.feedback?.foodRating ?? 10);
    setServiceRating(selectedBill?.feedback?.serviceRating ?? 10);
    setComment(selectedBill?.feedback?.comment ?? '');
    setConfirmingDelete(false);
  }, [selectedBill]);

  const save = () => {
    if (!selectedBill) return;
    const editing = Boolean(selectedBill.feedback);
    void mutate(
      {
        intent: editing ? 'update-feedback' : 'create-feedback',
        billId: selectedBill.billId,
        feedbackId: selectedBill.feedback?.id,
        payload: { foodRating, serviceRating, comment: comment.trim() || null },
      },
      {
        fallback: t('toast.feedbackSaveFailed'),
        success: t(editing ? 'toast.feedbackUpdated' : 'toast.feedbackCreated'),
      },
    );
  };

  const remove = () => {
    if (!selectedBill?.feedback) return;
    void mutate(
      {
        intent: 'delete-feedback',
        feedbackId: selectedBill.feedback.id,
      },
      {
        fallback: t('toast.feedbackDeleteFailed'),
        success: t('toast.feedbackDeleted'),
      },
    );
  };

  return (
    <section className="panel p-6" aria-labelledby="feedback-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="feedback-title" className="text-lg font-bold text-ink">
            <span className="title-mark mr-2" aria-hidden="true" />
            {t('feedback.title')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {data.aggregates.feedbackCount} {t('feedback.count')}
          </p>
        </div>
        <div className="flex gap-2" aria-label={t('feedback.title')}>
          <RatingSummary
            label={t('feedback.food')}
            value={data.aggregates.foodRating}
          />
          <RatingSummary
            label={t('feedback.service')}
            value={data.aggregates.serviceRating}
          />
        </div>
      </div>

      <div className="field-group mt-5">
        <h3 className="field-group-title">
          <MessageSquare size={13} aria-hidden="true" />
          {t('feedback.yourFeedback')}
        </h3>
        {data.eligibleBills.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            {t('feedback.noEligibleBills')}
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="block">
              <span className="label">{t('feedback.chooseBill')}</span>
              <div className="mt-1">
                <Dropdown
                  label={t('feedback.chooseBill')}
                  ariaLabel={t('feedback.chooseBill')}
                  value={selectedBill?.billId ?? ''}
                  onChange={setSelectedBillId}
                  options={data.eligibleBills.map((bill) => ({
                    value: bill.billId,
                    label: `${new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                    }).format(new Date(bill.billCreatedAt))}${bill.feedback ? ' · ✓' : ''}`,
                  }))}
                  searchable
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <RatingSelect
                label={t('feedback.food')}
                value={foodRating}
                onChange={setFoodRating}
              />
              <RatingSelect
                label={t('feedback.service')}
                value={serviceRating}
                onChange={setServiceRating}
              />
            </div>
            <label className="block">
              <span className="label">{t('feedback.comment')}</span>
              <textarea
                className="field mt-1 min-h-24 w-full resize-y py-2"
                maxLength={2000}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              {selectedBill?.feedback &&
                (confirmingDelete ? (
                  <div className="flex items-center gap-2" role="group">
                    <span className="text-sm text-slate-600">
                      {t('feedback.confirmDelete')}
                    </span>
                    <button
                      type="button"
                      className="btn btn-soft"
                      onClick={() => setConfirmingDelete(false)}
                    >
                      {t('auth.cancel')}
                    </button>
                    <button
                      type="button"
                      className="btn border-red-300 text-red-600"
                      disabled={fetcher.state !== 'idle'}
                      onClick={remove}
                    >
                      {t('common.confirm')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-soft text-red-600"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    {t('feedback.delete')}
                  </button>
                ))}
              <button
                type="button"
                className="btn btn-primary"
                disabled={fetcher.state !== 'idle'}
                onClick={save}
              >
                {selectedBill?.feedback
                  ? t('feedback.update')
                  : t('feedback.save')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-3">
        {data.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-slate-500">
            <MessageSquare className="mx-auto mb-2" aria-hidden="true" />
            {t('feedback.empty')}
          </div>
        ) : (
          data.items.map((feedback) => (
            <article
              key={feedback.id}
              className="rounded-xl border border-border p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{feedback.user.name}</p>
                  <p className="text-xs text-slate-500">
                    @{feedback.user.username} ·{' '}
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                    }).format(new Date(feedback.createdAt))}
                  </p>
                </div>
                <div className="ticket-figure flex gap-2 text-sm font-semibold">
                  <span>
                    {t('feedback.food')} {feedback.foodRating.toFixed(1)}
                  </span>
                  <span>
                    {t('feedback.service')} {feedback.serviceRating.toFixed(1)}
                  </span>
                </div>
              </div>
              {feedback.comment && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                  {feedback.comment}
                </p>
              )}
            </article>
          ))
        )}
      </div>
      {data.pageInfo.hasNextPage && data.pageInfo.endCursor && (
        <Link
          className="btn btn-soft mt-4 w-full justify-center"
          to={`?cursor=${encodeURIComponent(data.pageInfo.endCursor)}`}
        >
          {t('feedback.nextPage')}
        </Link>
      )}
    </section>
  );
}

function RatingSummary({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="chip-saffron rounded-lg px-3 py-2 text-center">
      <div className="ticket-figure flex items-center justify-center gap-1 text-sm font-bold">
        <Star size={14} fill="currentColor" aria-hidden="true" />
        {formatRating(value)}
      </div>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
    </div>
  );
}

function RatingSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="block">
      <span className="label">{label}</span>
      <div className="mt-1">
        <Dropdown
          label={label}
          ariaLabel={label}
          value={String(value)}
          onChange={(rating) => onChange(Number(rating))}
          options={ratingOptions.map((rating) => ({
            value: String(rating),
            label: `${rating.toFixed(1)} / 10`,
          }))}
        />
      </div>
    </div>
  );
}
