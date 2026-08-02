// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DiningAreaDetailPage from './DiningAreaDetailPage';

const navigate = vi.fn();
const revalidate = vi.fn();
const mutateAsync = vi.fn();

const area = {
  id: 'area-1',
  name: 'Rooftop',
  address: '1 Example Street',
  addressLine: null,
  provinceCode: null,
  provinceName: null,
  wardCode: null,
  wardName: null,
  description: 'Open-air dining.',
  defaultImage: {
    id: 'image-1',
    mimeType: 'image/jpeg',
    sizeBytes: 100,
    sortOrder: 0,
    imageUrl: 'https://example.com/rooftop.jpg',
    createdAt: '2026-07-30T00:00:00.000Z',
    updatedAt: '2026-07-30T00:00:00.000Z',
  },
  images: [
    {
      id: 'image-1',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      sortOrder: 0,
      imageUrl: 'https://example.com/rooftop.jpg',
      createdAt: '2026-07-30T00:00:00.000Z',
      updatedAt: '2026-07-30T00:00:00.000Z',
    },
    {
      id: 'image-2',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      sortOrder: 1,
      imageUrl: 'https://example.com/rooftop-2.jpg',
      createdAt: '2026-07-30T00:00:00.000Z',
      updatedAt: '2026-07-30T00:00:00.000Z',
    },
  ],
  restaurants: {
    items: [
      {
        id: 'restaurant-1',
        name: 'Example Restaurant',
        type: 'Restaurant',
        cuisineType: 'Vietnamese',
      },
    ],
    pageInfo: {
      startCursor: 'restaurant-1',
      endCursor: 'restaurant-1',
      hasPreviousPage: false,
      hasNextPage: false,
    },
  },
};

vi.mock('react-router', () => ({
  useLoaderData: () => area,
  useNavigate: () => navigate,
  useRevalidator: () => ({ revalidate }),
}));

vi.mock('@/app/providers/app-context', () => ({
  useAppContext: () => ({
    user: {
      id: 'chef-1',
      roles: ['CUSTOMER', 'SOUS_CHEF'],
      chefRole: 'SOUS_CHEF',
      systemRole: null,
    },
  }),
}));

vi.mock('@/app/providers/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('./dining-area-media.mutations', () => ({
  useDiningAreaMediaMutation: () => ({ mutateAsync }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DiningAreaDetailPage', () => {
  it('renders the area details, default background, gallery, and linked restaurants', () => {
    render(<DiningAreaDetailPage />);

    expect(screen.getByText('Rooftop')).toBeTruthy();
    expect(screen.getByText('1 Example Street')).toBeTruthy();
    expect(screen.getByText('Open-air dining.')).toBeTruthy();
    expect(screen.getByText('Example Restaurant')).toBeTruthy();
    expect(
      screen
        .getAllByRole('img')
        .some((image) => image.getAttribute('src')?.endsWith('rooftop.jpg')),
    ).toBe(true);
    expect(screen.getByText('catalog.diningAreas.defaultImage')).toBeTruthy();
  });

  it('can select a non-default gallery image as the default', async () => {
    mutateAsync.mockResolvedValueOnce({ defaultImageId: 'image-2' });
    render(<DiningAreaDetailPage />);

    fireEvent.click(screen.getByRole('button', { name: 'common.setDefault' }));

    await vi.waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        action: 'default',
        diningAreaId: 'area-1',
        imageId: 'image-2',
      }),
    );
    expect(revalidate).toHaveBeenCalled();
  });

  it('uploads every selected Dining Area image', async () => {
    mutateAsync.mockResolvedValue({});
    const { container } = render(<DiningAreaDetailPage />);
    const first = new File(['first'], 'first.jpg', { type: 'image/jpeg' });
    const second = new File(['second'], 'second.png', { type: 'image/png' });
    const input = container.querySelector<HTMLInputElement>(
      'input[type="file"][multiple]',
    );

    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { files: [first, second] } });

    await vi.waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    expect(mutateAsync).toHaveBeenNthCalledWith(1, {
      action: 'upload',
      diningAreaId: 'area-1',
      file: first,
    });
    expect(mutateAsync).toHaveBeenNthCalledWith(2, {
      action: 'upload',
      diningAreaId: 'area-1',
      file: second,
    });
    expect(revalidate).toHaveBeenCalled();
  });

  it('refreshes the gallery when part of a batch upload succeeds', async () => {
    mutateAsync
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('upload failed'));
    const { container } = render(<DiningAreaDetailPage />);
    const first = new File(['first'], 'first.jpg', { type: 'image/jpeg' });
    const second = new File(['second'], 'second.png', { type: 'image/png' });
    const input = container.querySelector<HTMLInputElement>(
      'input[type="file"][multiple]',
    );

    fireEvent.change(input!, { target: { files: [first, second] } });

    await vi.waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it('opens the full-size preview dialog for a gallery image', () => {
    render(<DiningAreaDetailPage />);

    const triggers = screen.getAllByRole('button', { name: 'Rooftop' });
    fireEvent.click(triggers[0]!);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      screen.getByText('Rooftop — catalog.diningAreas.galleryImage 1'),
    ).toBeTruthy();
  });

  it('opens the paginated Restaurant directory filtered to this area', () => {
    render(<DiningAreaDetailPage />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'catalog.diningAreas.viewAllRestaurants',
      }),
    );

    expect(navigate).toHaveBeenCalledWith('/restaurants?diningAreaId=area-1');
  });
});
