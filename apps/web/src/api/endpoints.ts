import type { ApiClient } from './client';
import type {
  AddressDirectoryResult,
  CatalogPage,
  Cuisine,
  DiningArea,
  PaymentQrImage,
} from './types';

export const addressEndpoints = {
  provinces: (api: ApiClient, search: string) =>
    api.request<AddressDirectoryResult>(
      `/address/provinces?search=${encodeURIComponent(search)}`,
    ),
  wards: (api: ApiClient, provinceCode: string, search: string) =>
    api.request<AddressDirectoryResult>(
      `/address/provinces/${encodeURIComponent(provinceCode)}/wards?search=${encodeURIComponent(search)}`,
    ),
};

const catalogPath = (
  resource: 'cuisines' | 'dining-areas',
  search: string,
  cursor?: string | null,
) => {
  const query = new URLSearchParams({ search, limit: '25' });
  if (cursor) query.set('cursor', cursor);
  return `/${resource}?${query}`;
};

export const restaurantCatalogEndpoints = {
  cuisines: (api: ApiClient, search: string, cursor?: string | null) =>
    api.request<CatalogPage<Cuisine>>(catalogPath('cuisines', search, cursor)),
  diningAreas: (api: ApiClient, search: string, cursor?: string | null) =>
    api.request<CatalogPage<DiningArea>>(
      catalogPath('dining-areas', search, cursor),
    ),
};

export const profileMediaEndpoints = {
  paymentQrImages: (api: ApiClient, billId?: string) =>
    api.request<PaymentQrImage[]>(
      billId ? `/bills/${billId}/payment-qr-options` : '/me/payment-qr-images',
    ),
  uploadAvatar: (api: ApiClient, file: File) => {
    const body = new FormData();
    body.append('file', file);
    return api.request('/me/avatar', { method: 'PUT', body });
  },
  removeAvatar: (api: ApiClient) =>
    api.request('/me/avatar', { method: 'DELETE' }),
  createPaymentQr: (api: ApiClient, label: string, file: File) => {
    const body = new FormData();
    body.append('label', label);
    body.append('file', file);
    return api.request('/me/payment-qr-images', { method: 'POST', body });
  },
  replacePaymentQr: (api: ApiClient, id: string, label: string, file: File) => {
    const body = new FormData();
    body.append('label', label);
    body.append('file', file);
    return api.request(`/me/payment-qr-images/${id}/replacement`, {
      method: 'POST',
      body,
    });
  },
  renamePaymentQr: (api: ApiClient, id: string, label: string) =>
    api.request(`/me/payment-qr-images/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ label }),
    }),
  removePaymentQr: (api: ApiClient, id: string) =>
    api.request(`/me/payment-qr-images/${id}`, { method: 'DELETE' }),
};

export const restaurantMediaEndpoints = {
  upload: (
    api: ApiClient,
    restaurantId: string,
    kind: 'logo' | 'banner',
    file: File,
  ) => {
    const body = new FormData();
    body.append('file', file);
    return api.request(`/restaurants/${restaurantId}/${kind}`, {
      method: 'PUT',
      body,
    });
  },
  remove: (api: ApiClient, restaurantId: string, kind: 'logo' | 'banner') =>
    api.request(`/restaurants/${restaurantId}/${kind}`, {
      method: 'DELETE',
    }),
};
