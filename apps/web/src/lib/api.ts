export type ChefRole = 'SOUS_CHEF' | 'HEAD_CHEF' | null;
export type PaymentStatus = 'PAID' | 'WAITING';
export type EntryStatus = 'ACTIVE' | 'ARCHIVED';

export type User = {
  id: string;
  username: string;
  phone?: string | null;
  name: string;
  chefRole: ChefRole;
  roles: string[];
};

export type RestaurantEntry = {
  id: string;
  name: string;
  address: string;
  cuisineType: string;
  type: string;
  avatarUrl?: string | null;
  links: { label?: string; url: string }[];
  isRecommended: boolean;
  isFavorite: boolean;
  isFavoritedByMe?: boolean;
  status: EntryStatus;
};

export type BillParticipant = {
  memberId: string;
  member: User;
  originCost: number;
  allocatedVat: number;
  allocatedShipping: number;
  discountApplied: number;
  finalPrice: number;
  paymentStatus: PaymentStatus;
  paidAt?: string | null;
};

export type Bill = {
  id: string;
  restaurant: RestaurantEntry;
  createdById: string;
  createdBy: User;
  baseCost: number;
  vat: number;
  shippingFee: number;
  totalCost: number;
  discounts: { type: 'FIXED' | 'PERCENTAGE'; value: number; label?: string }[];
  vouchers: { code: string; value: number }[];
  qrCodePath?: string | null;
  paymentUrl?: string | null;
  status: EntryStatus;
  createdAt: string;
  updatedAt: string;
  participants: BillParticipant[];
};

export type Stats = {
  total: number;
  byPaymentStatus: Record<string, number>;
  byCuisineType: Record<string, number>;
  byEntry: Record<string, number>;
  byPeriod: Record<string, number>;
  frequencyByRestaurant: Record<string, number>;
  frequencyByCuisine: Record<string, number>;
};

export type Notification = {
  id: string;
  billId?: string | null;
  message: string;
  readAt?: string | null;
  createdAt: string;
};

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  constructor(private token: string | null) {}

  setToken(token: string | null) {
    this.token = token;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...init.headers,
      },
    });
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      throw new ApiError(
        error.message ?? 'Request failed',
        response.status,
        error.code,
      );
    }
    return response.json() as Promise<T>;
  }

  login(identifier: string, password: string) {
    return this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
  }

  register(
    name: string,
    username: string,
    phone: string,
    password: string,
    inviteCode: string,
  ) {
    return this.request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name,
        username,
        phone: phone || undefined,
        password,
        inviteCode,
      }),
    });
  }
}

export const money = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
    amount,
  );
