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

const provinces = {
  items: [
    {
      code: 'p-thanh-pho-ho-chi-minh',
      name: 'Thành phố Hồ Chí Minh',
      aliases: ['Bình Dương', 'Bà Rịa - Vũng Tàu'],
    },
    { code: 'p-ha-noi', name: 'Hà Nội' },
  ],
  stale: false,
} satisfies AddressDirectoryResult;

const hoChiMinhWards = {
  items: [
    { code: 'sai-gon-a1b2c3', name: 'Phường Sài Gòn' },
    { code: 'di-an-d4e5f6', name: 'Phường Dĩ An' },
  ],
  stale: false,
} satisfies AddressDirectoryResult;

const directoryLoader = vi.fn(async (path: string) =>
  path.endsWith('/wards') ? hoChiMinhWards : provinces,
);

describe('VietnamAddressFields', () => {
  it('cascades local province and ward selection into a formatted snapshot', async () => {
    render(<Harness loader={directoryLoader} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Street address' }), {
      target: { value: '12 Lê Lợi' },
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Province / city' }),
    );
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
      await screen.findByRole('option', { name: 'Phường Sài Gòn' }),
    );

    expect(screen.getByTestId('value').textContent).toContain(
      '12 Lê Lợi, Phường Sài Gòn, Thành phố Hồ Chí Minh',
    );
  });

  it('remaps direct legacy province and ward snapshots by normalized name', async () => {
    render(
      <Harness
        loader={directoryLoader}
        initial={{
          address: '12 Lê Lợi, Phường Sài Gòn, Thành phố Hồ Chí Minh',
          addressLine: '12 Lê Lợi',
          provinceCode: '79',
          provinceName: 'TP. Hồ Chí Minh',
          wardCode: '26734',
          wardName: 'phuong sai gon',
        }}
      />,
    );

    await waitFor(() => {
      const value = screen.getByTestId('value').textContent ?? '';
      expect(value).toContain('"provinceCode":"p-thanh-pho-ho-chi-minh"');
      expect(value).toContain('"wardCode":"sai-gon-a1b2c3"');
      expect(value).toContain('"wardName":"Phường Sài Gòn"');
    });
  });

  it('remaps a former province through its merger alias', async () => {
    render(
      <Harness
        loader={directoryLoader}
        initial={{
          address: '1 Main, Phường Dĩ An, Bình Dương',
          addressLine: '1 Main',
          provinceCode: '74',
          provinceName: 'Tỉnh Bình Dương',
          wardCode: 'legacy-ward',
          wardName: 'Phường Dĩ An',
        }}
      />,
    );

    await waitFor(() => {
      const value = screen.getByTestId('value').textContent ?? '';
      expect(value).toContain('"provinceName":"Thành phố Hồ Chí Minh"');
      expect(value).toContain('"wardCode":"di-an-d4e5f6"');
    });
  });

  it('clears unmatched legacy selections while preserving the saved snapshot', async () => {
    render(
      <Harness
        loader={directoryLoader}
        initial={{
          address: 'Saved historical address',
          addressLine: 'Old street',
          provinceCode: '999',
          provinceName: 'Unknown province',
          wardCode: '99999',
          wardName: 'Unknown ward',
        }}
      />,
    );

    expect(
      await screen.findByText(/saved address uses the previous directory/i),
    ).toBeTruthy();
    const value = screen.getByTestId('value').textContent ?? '';
    expect(value).toContain('"address":"Saved historical address"');
    expect(value).toContain('"addressLine":"Old street"');
    expect(value).toContain('"provinceCode":null');
    expect(value).toContain('"wardCode":null');
  });

  it('keeps a remapped province and requires reselection for an unknown ward', async () => {
    render(
      <Harness
        loader={directoryLoader}
        initial={{
          address: 'Saved merged address',
          addressLine: 'Old street',
          provinceCode: '74',
          provinceName: 'Bình Dương',
          wardCode: 'missing',
          wardName: 'Unknown ward',
        }}
      />,
    );

    expect(await screen.findByText(/select the current ward/i)).toBeTruthy();
    const value = screen.getByTestId('value').textContent ?? '';
    expect(value).toContain('"provinceCode":"p-thanh-pho-ho-chi-minh"');
    expect(value).toContain('"wardCode":null');
    expect(value).toContain('"address":"Saved merged address"');
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

  it('retains retry behavior for unexpected directory failures', async () => {
    let attempts = 0;
    const loader = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('unavailable');
      return { ...provinces, stale: true };
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
