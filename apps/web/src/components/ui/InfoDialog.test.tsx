// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/app/providers/i18n';

import InfoDialog from './InfoDialog';

const renderInfo = (onClose = () => undefined) => {
  localStorage.setItem('ff-locale', 'en');
  return render(
    <I18nProvider>
      <InfoDialog open onClose={onClose} />
    </I18nProvider>,
  );
};

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('InfoDialog', () => {
  it('introduces the app as a labelled dialog', () => {
    renderInfo();

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'About this app' }),
    ).toBeTruthy();
    expect(screen.getByText('FF RESTaurent')).toBeTruthy();
  });

  it('reports the build version injected at compile time', () => {
    renderInfo();

    expect(__APP_VERSION__).toMatch(/^\d+\.\d+\.\d+/);
    expect(screen.getByText(`Version ${__APP_VERSION__}`)).toBeTruthy();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    renderInfo(onClose);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });
});
