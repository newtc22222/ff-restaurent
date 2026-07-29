// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ConfirmDialog from './ConfirmDialog';

afterEach(cleanup);

const mockT = (key: string) => key;

describe('ConfirmDialog', () => {
  it('renders in document body portal with dialog role and handles confirmation', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        title="Block user"
        message="Are you sure?"
        onConfirm={onConfirm}
        onCancel={onCancel}
        t={mockT}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.parentElement?.className).toContain('overlay-backdrop');
    expect(dialog.ownerDocument.body.contains(dialog)).toBe(true);

    fireEvent.click(screen.getByText('common.confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape key press when not pending', () => {
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        title="Block user"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
        t={mockT}
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
