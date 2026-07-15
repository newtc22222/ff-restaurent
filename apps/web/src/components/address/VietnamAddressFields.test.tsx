// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../app/providers/i18n';
import type { AddressDirectoryResult, VietnamAddress } from '../../lib/api';
import VietnamAddressFields, {
  emptyVietnamAddress,
} from './VietnamAddressFields';

const { toastMessage, toastError } = vi.hoisted(() => ({
  toastMessage: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(toastMessage, { error: toastError }),
}));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('ff-locale', 'en');
  toastMessage.mockClear();
  toastError.mockClear();
});

afterEach(cleanup);

function Harness({
  loader,
  initial = emptyVietnamAddress(),
}: {
  loader: (path: string) => Promise<AddressDirectoryResult>;
  initial?: VietnamAddress;
}) {
  const [value, setValue] = useState(initial);
  return (
    <I18nProvider>
      <VietnamAddressFields
        value={value}
        onChange={setValue}
        loadDirectory={loader}
      />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </I18nProvider>
  );
}

const directoryLoader = vi.fn(async (path: string) => {
  if (path.endsWith('/wards')) {
    return {
      items: [{ code: '26734', name: 'Phường Bến Nghé' }],
      stale: false,
    };
  }
  return {
    items: [
      { code: '79', name: 'Thành phố Hồ Chí Minh' },
      { code: '1', name: 'Thành phố Hà Nội' },
    ],
    stale: false,
  };
});

describe('VietnamAddressFields', () => {
  it('cascades province and ward selection into a formatted snapshot', async () => {
    render(<Harness loader={directoryLoader} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Street address' }), {
      target: { value: '12 Lê Lợi' },
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Province / city' }),
      ).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Province / city' }));
    fireEvent.click(
      await screen.findByRole('option', { name: 'Thành phố Hồ Chí Minh' }),
    );
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Ward' }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ward' }));
    fireEvent.click(
      await screen.findByRole('option', { name: 'Phường Bến Nghé' }),
    );

    expect(screen.getByTestId('value').textContent).toContain(
      '12 Lê Lợi, Phường Bến Nghé, Thành phố Hồ Chí Minh',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Province / city' }));
    fireEvent.click(
      await screen.findByRole('option', { name: 'Thành phố Hà Nội' }),
    );
    expect(screen.getByTestId('value').textContent).toContain(
      '"wardCode":null',
    );
  });

  it('supports manual fallback and clears structured fields', async () => {
    render(<Harness loader={directoryLoader} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Enter address manually' }),
    );
    const manual = screen.getByRole('textbox', { name: 'Address' });
    fireEvent.change(manual, { target: { value: 'Manual address, Việt Nam' } });

    const value = screen.getByTestId('value').textContent ?? '';
    expect(value).toContain('Manual address, Việt Nam');
    expect(value).toContain('"provinceCode":null');
  });

  it('surfaces stale data and can retry a failed directory load', async () => {
    let attempts = 0;
    const loader = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('offline');
      return {
        items: [{ code: '79', name: 'Thành phố Hồ Chí Minh' }],
        stale: true,
      };
    });
    render(<Harness loader={loader} />);

    const retry = await screen.findByRole('button', {
      name: /could not be loaded.*retry/i,
    });
    expect(toastError).toHaveBeenCalledTimes(1);
    fireEvent.click(retry);

    expect(await screen.findByText(/Using saved address data/)).toBeTruthy();
    expect(toastMessage).toHaveBeenCalledTimes(1);
  });
});
