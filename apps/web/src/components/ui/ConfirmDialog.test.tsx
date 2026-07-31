// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/app/providers/i18n';

import ConfirmDialog from './ConfirmDialog';

const renderDialog = ({
  locale = 'en',
  pending = false,
  onConfirm = vi.fn(),
  onCancel = vi.fn(),
}: {
  locale?: 'en' | 'vi';
  pending?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
} = {}) => {
  localStorage.setItem('ff-locale', locale);
  const result = render(
    <I18nProvider>
      <ConfirmDialog
        title="Block user"
        message="Are you sure?"
        onConfirm={onConfirm}
        onCancel={onCancel}
        pending={pending}
      />
    </I18nProvider>,
  );
  return { ...result, onConfirm, onCancel };
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'requestAnimationFrame',
    (callback: FrameRequestCallback): number => {
      callback(0);
      return 1;
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ConfirmDialog', () => {
  it('renders English actions in the body portal and handles confirmation', () => {
    const { onConfirm } = renderDialog();

    const dialog = screen.getByRole('dialog');
    expect(dialog.parentElement?.className).toContain('overlay-backdrop');
    expect(dialog.ownerDocument.body.contains(dialog)).toBe(true);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('reads Vietnamese action labels from the local i18n hook', () => {
    renderDialog({ locale: 'vi' });

    expect(screen.getByRole('button', { name: 'Hủy' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeTruthy();
  });

  it('shows localized pending copy and blocks dismissal while pending', () => {
    const { onCancel } = renderDialog({ pending: true });

    expect(
      (
        screen.getByRole('button', {
          name: 'Loading latest data...',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('focuses the first action, closes on Escape, and restores prior focus', async () => {
    const previous = document.createElement('button');
    document.body.append(previous);
    previous.focus();
    const { onCancel, unmount } = renderDialog();

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Cancel' }),
      ),
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);

    unmount();
    expect(document.activeElement).toBe(previous);
    previous.remove();
  });
});
