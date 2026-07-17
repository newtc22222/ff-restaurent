export type ChefRole = 'SOUS_CHEF' | 'HEAD_CHEF' | null;
export type SystemRole = 'ROOT_ADMIN' | null;
export type PaymentStatus = 'PAID' | 'WAITING';
export type EntryStatus = 'ACTIVE' | 'ARCHIVED';
export type RestaurantPlatform =
  | 'GRAB'
  | 'SHOPEE_FOOD'
  | 'BE_FOOD'
  | 'GOJEK'
  | 'WEBSITE'
  | 'FACEBOOK'
  | 'OTHER';

export type RestaurantPlatformLink = {
  id?: string;
  platform: RestaurantPlatform;
  label?: string | null;
  url: string;
  sortOrder?: number;
};

export type Cuisine = {
  id: string;
  name: string;
  type: string;
  description?: string | null;
};

export type DiningArea = {
  id: string;
  name: string;
  address: string;
  addressLine?: string | null;
  provinceCode?: string | null;
  provinceName?: string | null;
  wardCode?: string | null;
  wardName?: string | null;
  description?: string | null;
};

export type CatalogPage<T> = {
  items: T[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
};

export type BillPage = {
  items: Bill[];
  pageInfo: {
    startCursor: string | null;
    endCursor: string | null;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
};

export type CollectionSystemType = 'FAVORITES' | 'RECOMMENDED' | null;

export type Collection = {
  id: string;
  name: string;
  description?: string | null;
  isPublic: boolean;
  systemType: CollectionSystemType;
  ownerId?: string | null;
  owner?: Pick<User, 'id' | 'username' | 'name'> | null;
  _count: { restaurants: number; shares: number };
  createdAt: string;
  updatedAt: string;
};

export type CollectionRestaurant = RestaurantEntry & { addedAt: string };

export type CollectionShare = Pick<User, 'id' | 'username' | 'name'> & {
  sharedAt: string;
};

export type CollectionDetailData = {
  collection: Collection;
  restaurants: CatalogPage<CollectionRestaurant>;
  shares: CatalogPage<CollectionShare> | null;
};

export type RestaurantDirectoryData = CatalogPage<RestaurantEntry> & {
  collections: Collection[];
};

export type User = {
  id: string;
  username: string;
  phone?: string | null;
  name: string;
  chefRole: ChefRole;
  systemRole: SystemRole;
  roles: string[];
  paymentRemindersEnabled?: boolean;
};

export type ParticipantGroup = {
  id: string;
  name: string;
  ownerId: string;
  members: { userId: string; user: User }[];
  createdAt: string;
  updatedAt: string;
};

export type RestaurantEntry = {
  id: string;
  name: string;
  address: string;
  addressLine?: string | null;
  provinceCode?: string | null;
  provinceName?: string | null;
  wardCode?: string | null;
  wardName?: string | null;
  phone?: string | null;
  bannerImageUrl?: string | null;
  diningAreaId?: string | null;
  diningArea?: DiningArea | null;
  cuisineType: string;
  type: string;
  avatarUrl?: string | null;
  platformLinks?: RestaurantPlatformLink[];
  cuisines?: { isPrimary: boolean; cuisine: Cuisine }[];
  isRecommended: boolean;
  isFavorite: boolean;
  isFavoritedByMe?: boolean;
  status: EntryStatus;
  feedbackAggregates?: FeedbackAggregates;
};

export type FeedbackAggregates = {
  foodRating: number | null;
  serviceRating: number | null;
  feedbackCount: number;
};

export type RestaurantFeedback = {
  id: string;
  billId: string;
  restaurantId: string;
  foodRating: number;
  serviceRating: number;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
  user: Pick<User, 'id' | 'username' | 'name'>;
};

export type RestaurantFeedbackPage = {
  items: RestaurantFeedback[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
  aggregates: FeedbackAggregates;
  eligibleBills: {
    billId: string;
    billCreatedAt: string;
    billStatus: EntryStatus;
    feedback: RestaurantFeedback | null;
  }[];
};

export type VietnamAddress = Pick<
  RestaurantEntry,
  | 'address'
  | 'addressLine'
  | 'provinceCode'
  | 'provinceName'
  | 'wardCode'
  | 'wardName'
>;

export type AddressDirectoryResult = {
  items: { code: string; name: string }[];
  stale: boolean;
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
  adjustmentAllocation: 'EQUAL' | 'PROPORTIONAL';
  qrCodePath?: string | null;
  paymentUrl?: string | null;
  status: EntryStatus;
  createdAt: string;
  updatedAt: string;
  participants: BillParticipant[];
};

export type BillActivityAction =
  | 'CREATED'
  | 'UPDATED'
  | 'PAYMENT_STATUS_CHANGED'
  | 'REMINDERS_SENT'
  | 'ARCHIVED'
  | 'RESTORED';

export type BillActivityEvent = {
  id: string;
  action: BillActivityAction;
  actor: Pick<User, 'id' | 'username' | 'name'>;
  details?: {
    changes?: string[];
    memberId?: string;
    memberName?: string;
    fromStatus?: PaymentStatus;
    toStatus?: PaymentStatus;
    sent?: number;
    skipped?: number;
  };
  createdAt: string;
};

export type Stats = {
  totals: {
    paid: number;
    waiting: number;
    totalObligation: number;
  };
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

export type PasswordResetRequest = {
  id: string;
  status: 'PENDING' | 'CODE_ISSUED';
  expiresAt?: string | null;
  failedAttempts: number;
  createdAt: string;
  user: Pick<User, 'id' | 'username' | 'name' | 'phone' | 'systemRole'>;
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
    if (response.status === 204) return undefined as T;
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
