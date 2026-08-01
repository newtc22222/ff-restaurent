// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
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

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Create restaurant" onClose={onClose}>
        <p>Form</p>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('wraps focus from the last focusable element to the first on Tab', () => {
    render(
      <Modal open title="Create restaurant" onClose={() => undefined}>
        <button>First field</button>
        <button>Last field</button>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    const buttons = Array.from(dialog.querySelectorAll('button'));
    const closeButton = buttons[0];
    const lastField = buttons[buttons.length - 1];

    lastField.focus();
    expect(document.activeElement).toBe(lastField);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(closeButton);
  });

  it('wraps focus from the first focusable element to the last on Shift+Tab', () => {
    render(
      <Modal open title="Create restaurant" onClose={() => undefined}>
        <button>First field</button>
        <button>Last field</button>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    const buttons = Array.from(dialog.querySelectorAll('button'));
    const closeButton = buttons[0];
    const lastField = buttons[buttons.length - 1];

    closeButton.focus();
    expect(document.activeElement).toBe(closeButton);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(lastField);
  });

  it('restores focus to the previously focused element on close', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open trigger</button>
          <Modal
            open={open}
            title="Create restaurant"
            onClose={() => setOpen(false)}
          >
            <p>Form</p>
          </Modal>
        </>
      );
    }
    render(<Harness />);

    const trigger = screen.getByText('Open trigger');
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(trigger);
  });
});
