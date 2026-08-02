// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AccentProvider, initializeAccent, useAccent } from './accent';

function AccentProbe() {
  const { accent, setAccent } = useAccent();
  return (
    <div>
      <span data-testid="accent">{accent}</span>
      <button type="button" onClick={() => setAccent('basil')}>
        pick basil
      </button>
    </div>
  );
}

const renderProbe = () =>
  render(
    <AccentProvider>
      <AccentProbe />
    </AccentProvider>,
  );

// No global setup file exists, so storage and the html attribute both leak
// between tests unless cleared by hand.
beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.accent;
});

afterEach(cleanup);

describe('AccentProvider', () => {
  it('defaults to saffron when nothing is stored', () => {
    renderProbe();

    expect(screen.getByTestId('accent').textContent).toBe('saffron');
    expect(document.documentElement.dataset.accent).toBe('saffron');
  });

  it('restores a previously chosen accent', () => {
    localStorage.setItem('ff-accent', 'chili');

    renderProbe();

    expect(screen.getByTestId('accent').textContent).toBe('chili');
    expect(document.documentElement.dataset.accent).toBe('chili');
  });

  it('can apply the stored accent before the provider mounts', () => {
    localStorage.setItem('ff-accent', 'basil');

    initializeAccent();

    expect(document.documentElement.dataset.accent).toBe('basil');
  });

  it('falls back to the default when the stored value is not an accent', () => {
    localStorage.setItem('ff-accent', 'chartreuse');

    renderProbe();

    expect(screen.getByTestId('accent').textContent).toBe('saffron');
    expect(document.documentElement.dataset.accent).toBe('saffron');
  });

  it('persists the accent and applies it to the document', () => {
    renderProbe();

    fireEvent.click(screen.getByRole('button', { name: 'pick basil' }));

    expect(screen.getByTestId('accent').textContent).toBe('basil');
    expect(localStorage.getItem('ff-accent')).toBe('basil');
    expect(document.documentElement.dataset.accent).toBe('basil');
  });

  it('throws when used outside the provider', () => {
    expect(() => render(<AccentProbe />)).toThrow(
      'useAccent must be used within AccentProvider',
    );
  });
});
