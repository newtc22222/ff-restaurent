// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../app/providers/theme';
import ToastHost from './ToastHost';

const { toaster } = vi.hoisted(() => ({
  toaster: vi.fn((_props: unknown) => null),
}));

vi.mock('react-hot-toast', () => ({ Toaster: toaster }));

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  toaster.mockClear();
});

const renderHost = (mobile: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(max-width: 639px)' ? mobile : false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  render(
    <ThemeProvider>
      <ToastHost />
    </ThemeProvider>,
  );
  return toaster.mock.calls.at(-1)?.[0] as unknown as {
    position: string;
    toastOptions: { style: { background: string }; ariaProps: object };
  };
};

describe('ToastHost', () => {
  it('uses the desktop position and accessible light theme by default', () => {
    const props = renderHost(false);
    expect(props.position).toBe('top-right');
    expect(props.toastOptions.style.background).toBe('#ffffff');
    expect(props.toastOptions.ariaProps).toEqual({
      role: 'status',
      'aria-live': 'polite',
    });
  });

  it('uses a centered mobile position and dark theme tokens', () => {
    localStorage.setItem('ff-theme', 'dark');
    const props = renderHost(true);
    expect(props.position).toBe('top-center');
    expect(props.toastOptions.style.background).toBe('hsl(220 15% 13%)');
  });
});
