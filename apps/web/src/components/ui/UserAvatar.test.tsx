// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import UserAvatar from './UserAvatar';

afterEach(cleanup);

describe('UserAvatar', () => {
  it('renders initials when no avatarUrl is provided', () => {
    render(<UserAvatar name="Nguyen Van A" />);
    const avatar = screen.getByRole('img', { name: 'Nguyen Van A' });
    expect(avatar.textContent).toBe('NV');
  });

  it('renders an image when a valid avatarUrl is provided', () => {
    render(
      <UserAvatar
        name="Tran Thi B"
        avatarUrl="https://example.com/avatar.jpg"
      />,
    );
    const img = screen.getByRole('img', { name: 'Tran Thi B' });
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toBe('https://example.com/avatar.jpg');
  });

  it('falls back to initials when the image fails to load', () => {
    render(
      <UserAvatar name="Le Van C" avatarUrl="https://example.com/broken.jpg" />,
    );
    const img = screen.getByRole('img', { name: 'Le Van C' });
    expect(img.tagName).toBe('IMG');

    // Trigger image loading error
    fireEvent.error(img);

    const fallback = screen.getByRole('img', { name: 'Le Van C' });
    expect(fallback.tagName).toBe('DIV');
    expect(fallback.textContent).toBe('LV');
  });

  it('applies custom size classes and additional class names', () => {
    const { container } = render(
      <UserAvatar
        name="Pham D"
        size="lg"
        className="border-2 border-primary"
      />,
    );
    const avatar = container.firstElementChild;
    expect(avatar?.className).toContain('h-12 w-12');
    expect(avatar?.className).toContain('border-2 border-primary');
  });

  it('preserves empty alt text for decorative avatars and hides fallback from accessibility tree', () => {
    const { container: imgContainer } = render(
      <UserAvatar
        name="Nguyen Van A"
        avatarUrl="https://example.com/avatar.jpg"
        alt=""
      />,
    );
    const img = imgContainer.querySelector('img');
    expect(img?.getAttribute('alt')).toBe('');

    const { container: fallbackContainer } = render(
      <UserAvatar name="Nguyen Van A" alt="" />,
    );
    const fallback = fallbackContainer.firstElementChild;
    expect(fallback?.getAttribute('aria-hidden')).toBe('true');
    expect(fallback?.getAttribute('role')).toBeNull();
  });
});
