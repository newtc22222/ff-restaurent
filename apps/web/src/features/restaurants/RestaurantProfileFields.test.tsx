// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../../app/providers/i18n';
import RestaurantBanner from './RestaurantBanner';
import RestaurantProfileFields, {
  emptyRestaurantProfile,
  isRestaurantProfileValid,
  type RestaurantProfileDraft,
} from './RestaurantProfileFields';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('ff-locale', 'en');
});
afterEach(cleanup);

function Harness() {
  const [value, setValue] = useState(emptyRestaurantProfile());
  return (
    <I18nProvider>
      <RestaurantProfileFields value={value} onChange={setValue} />
      <output data-testid="profile">{JSON.stringify(value)}</output>
    </I18nProvider>
  );
}

describe('restaurant profile fields', () => {
  it('validates phone and supports ordered removable platform links', () => {
    render(<Harness />);
    const fields = screen.getAllByRole('textbox');
    fireEvent.change(fields[0]!, { target: { value: 'not-a-phone' } });
    expect(screen.getByText(/valid Vietnamese mobile/)).toBeTruthy();
    fireEvent.change(fields[0]!, { target: { value: '0901234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Link URL 1' }), {
      target: { value: 'https://example.test/menu' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Platform 2' }));
    fireEvent.click(screen.getByRole('option', { name: 'Other' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Custom label 2' }), {
      target: { value: 'Reservations' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Link URL 2' }), {
      target: { value: 'https://booking.test/table' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Move up 2' }));

    const profile = screen.getByTestId('profile').textContent ?? '';
    expect(profile.indexOf('OTHER')).toBeLessThan(profile.indexOf('WEBSITE'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove link 1' }));
    expect(screen.queryByDisplayValue('Reservations')).toBeNull();
  });

  it('defines the same completeness rules used by create and edit forms', () => {
    const valid: RestaurantProfileDraft = {
      phone: '0901234567',
      bannerImageUrl: 'https://image.test/banner.jpg',
      platformLinks: [
        { platform: 'OTHER', label: 'Book', url: 'https://book.test' },
      ],
    };
    expect(isRestaurantProfileValid(valid)).toBe(true);
    expect(
      isRestaurantProfileValid({
        ...valid,
        platformLinks: [
          ...valid.platformLinks,
          { platform: 'OTHER', label: 'Same', url: 'https://book.test/' },
        ],
      }),
    ).toBe(false);
  });
});

describe('RestaurantBanner', () => {
  it('falls back when an optional banner cannot load', () => {
    render(
      <RestaurantBanner name="Lunch place" url="https://image.test/x.jpg" />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Lunch place banner' }));
    expect(screen.getByTestId('restaurant-banner-fallback')).toBeTruthy();
    expect(screen.getByText('Banner unavailable')).toBeTruthy();
  });
});
