// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/app/providers/i18n';

import ImagePreviewDialog from './ImagePreviewDialog';

const renderPreview = (
  props: Partial<Parameters<typeof ImagePreviewDialog>[0]> = {},
) => {
  localStorage.setItem('ff-locale', 'en');
  return render(
    <I18nProvider>
      <ImagePreviewDialog
        open
        onClose={() => undefined}
        src="https://example.com/image.png"
        title="Payment QR"
        alt="Payment QR"
        {...props}
      />
    </I18nProvider>,
  );
};

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('ImagePreviewDialog', () => {
  it('renders as a labelled dialog with the given title', () => {
    renderPreview();

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Payment QR')).toBeTruthy();
  });

  it('shows a loading indicator until the image loads', () => {
    renderPreview();

    expect(screen.getByRole('status')).toBeTruthy();
    const img = screen.getByAltText('Payment QR') as HTMLImageElement;
    expect(img.className).toContain('hidden');

    fireEvent.load(img);
    expect(screen.queryByRole('status')).toBeNull();
    expect(img.className).not.toContain('hidden');
  });

  it('shows a manual-retry error state for public (non-signed) images on load failure', () => {
    renderPreview();

    fireEvent.error(screen.getByAltText('Payment QR'));

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Retry')).toBeTruthy();
  });

  it('recovers after a manual retry once the image loads', () => {
    renderPreview();

    fireEvent.error(screen.getByAltText('Payment QR'));
    expect(screen.getByRole('alert')).toBeTruthy();

    fireEvent.click(screen.getByText('Retry'));
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.load(screen.getByAltText('Payment QR'));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('auto-retries once for signed URLs, then shows the terminal error state if it fails again', () => {
    const onRetry = vi.fn();
    renderPreview({ onRetry, isSignedUrl: true });

    const img = screen.getByAltText('Payment QR');

    fireEvent.error(img);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.error(img);
    expect(screen.getByRole('alert')).toBeTruthy();

    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(2);

    const closeButton = screen.getByLabelText('Close');
    expect(closeButton).toBeTruthy();
    fireEvent.click(closeButton);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    renderPreview({ onClose });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on backdrop click', () => {
    const onClose = vi.fn();
    renderPreview({ onClose });

    const backdrop = screen.getByRole('dialog').parentElement!;
    fireEvent.mouseDown(backdrop, { target: backdrop });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('contains Tab focus within the dialog', () => {
    renderPreview();
    fireEvent.error(screen.getByAltText('Payment QR'));

    const dialog = screen.getByRole('dialog');
    const buttons = Array.from(dialog.querySelectorAll('button'));
    const closeButton = buttons[0];
    const retryButton = buttons[buttons.length - 1];

    retryButton.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(closeButton);

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(retryButton);
  });

  it('restores focus to the originating trigger control on close', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <I18nProvider>
          <button onClick={() => setOpen(true)}>View image</button>
          <ImagePreviewDialog
            open={open}
            onClose={() => setOpen(false)}
            src="https://example.com/image.png"
            title="Payment QR"
            alt="Payment QR"
          />
        </I18nProvider>
      );
    }
    render(<Harness />);

    const trigger = screen.getByText('View image');
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(trigger);
  });
});
