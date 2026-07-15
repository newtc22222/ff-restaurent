// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { I18nProvider } from '../../app/providers/i18n';
import type { RestaurantFeedbackPage } from '../../lib/api';
import RestaurantFeedback from './RestaurantFeedback';

const mutate = vi.fn();
vi.mock('../../hooks/useMutation', () => ({
  useMutation: () => ({
    fetcher: { state: 'idle' },
    mutate,
  }),
}));

const feedback = {
  id: 'feedback-1',
  billId: 'bill-1',
  restaurantId: 'restaurant-1',
  foodRating: 8.5,
  serviceRating: 7.5,
  comment: 'Great food',
  createdAt: '2026-07-15T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
  user: { id: 'user-1', username: 'customer', name: 'Customer' },
};

const data: RestaurantFeedbackPage = {
  items: [feedback],
  pageInfo: { endCursor: 'feedback-1', hasNextPage: true },
  aggregates: { foodRating: 8.5, serviceRating: 7.5, feedbackCount: 1 },
  eligibleBills: [
    {
      billId: 'bill-1',
      billCreatedAt: '2026-07-15T09:00:00.000Z',
      billStatus: 'ACTIVE',
      feedback,
    },
  ],
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('ff-locale', 'en');
  mutate.mockClear();
});

afterEach(cleanup);

const renderFeedback = (value = data) =>
  render(
    <MemoryRouter>
      <I18nProvider>
        <RestaurantFeedback data={value} />
      </I18nProvider>
    </MemoryRouter>,
  );

describe('RestaurantFeedback', () => {
  it('shows separate aggregates and submits half-point author edits', () => {
    renderFeedback();

    expect(screen.getByText('8.5')).toBeTruthy();
    expect(screen.getAllByText('7.5').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Great food').length).toBe(2);
    const ratingSelects = screen.getAllByRole('combobox');
    fireEvent.change(ratingSelects[1], { target: { value: '9.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update feedback' }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: 'update-feedback',
        feedbackId: 'feedback-1',
        payload: expect.objectContaining({ foodRating: 9.5 }),
      }),
      expect.objectContaining({ success: 'Feedback updated.' }),
    );
    expect(
      screen.getByRole('link', { name: 'View more feedback' }),
    ).toBeTruthy();
  });

  it('requires explicit confirmation before deleting', () => {
    renderFeedback();
    fireEvent.click(screen.getByRole('button', { name: 'Delete feedback' }));
    expect(screen.getByText('Confirm deleting this feedback?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: 'delete-feedback',
        feedbackId: 'feedback-1',
      }),
      expect.objectContaining({ success: 'Feedback deleted.' }),
    );
  });

  it('keeps empty and ineligible states in the page', () => {
    renderFeedback({
      items: [],
      pageInfo: { endCursor: null, hasNextPage: false },
      aggregates: { foodRating: null, serviceRating: null, feedbackCount: 0 },
      eligibleBills: [],
    });
    expect(
      screen.getByText(
        'You can leave feedback after paying your share of a bill.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('No feedback has been shared for this restaurant.'),
    ).toBeTruthy();
  });
});
