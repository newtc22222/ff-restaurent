// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Modal from './Modal';

afterEach(cleanup);

describe('Modal', () => {
  it('renders its body in a centered native scroll area', () => {
    render(
      <Modal open title="Edit group" onClose={() => undefined}>
        <p>Visible modal content</p>
      </Modal>,
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('dialog').parentElement?.className).toContain(
      'place-items-center',
    );
    expect(screen.getByText('Visible modal content')).toBeTruthy();
    const scrollArea = screen
      .getByText('Visible modal content')
      .closest('[data-scroll-area]');
    expect(scrollArea).toBeTruthy();
    expect(scrollArea?.className).toContain('overflow-y-auto');
    expect(scrollArea?.className).toContain('max-h-');
  });

  it('prevents closing on backdrop click by default', () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Create restaurant" onClose={onClose}>
        <p>Form</p>
      </Modal>,
    );

    const backdrop = screen.getByRole('dialog').parentElement!;
    fireEvent.mouseDown(backdrop, { target: backdrop });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('allows closing on backdrop click when closeOnClickOutside is true', () => {
    const onClose = vi.fn();
    render(
      <Modal
        open
        title="Create restaurant"
        onClose={onClose}
        closeOnClickOutside
      >
        <p>Form</p>
      </Modal>,
    );

    const backdrop = screen.getByRole('dialog').parentElement!;
    fireEvent.mouseDown(backdrop, { target: backdrop });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
