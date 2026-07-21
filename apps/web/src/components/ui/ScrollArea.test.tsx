// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ScrollArea from './ScrollArea';

afterEach(cleanup);

describe('ScrollArea', () => {
  it.each([
    ['y', 'overflow-y-auto', 'overflow-x-hidden'],
    ['x', 'overflow-x-auto', 'overflow-y-hidden'],
    ['both', 'overflow-auto', ''],
  ] as const)(
    'maps the %s axis to native overflow classes',
    (axis, first, second) => {
      render(
        <ScrollArea axis={axis} className="h-20" contentClassName="p-2">
          <span>Scrollable content</span>
        </ScrollArea>,
      );

      const area = screen
        .getByText('Scrollable content')
        .closest('[data-scroll-area]');
      expect(area?.getAttribute('data-axis')).toBe(axis);
      expect(area?.className).toContain(first);
      if (second) expect(area?.className).toContain(second);
      expect(area?.className).toContain('scroll-area');
      expect(
        screen.getByText('Scrollable content').parentElement?.className,
      ).toBe('p-2');
    },
  );

  it('passes inline styles to the native scrolling element', () => {
    render(
      <ScrollArea style={{ maxHeight: 120 }}>
        <span>Styled content</span>
      </ScrollArea>,
    );

    const area = screen
      .getByText('Styled content')
      .closest('[data-scroll-area]');
    expect((area as HTMLElement).style.maxHeight).toBe('120px');
  });
});
