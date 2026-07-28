import type {
  ChefRoleValue,
  CollectionSystemTypeValue,
  EntryStatusValue,
  PaymentStatusValue,
  RestaurantPlatformValue,
  SystemRoleValue,
} from '@ff-restaurent/shared';
import type { components } from './generated/api-types';
import { createTransportClient } from './generated/transport-client';

type GeneratedSchemas = components['schemas'];

/*
 * Domain enums are owned by @ff-restaurent/shared, which mirrors the Prisma
 * schema. These aliases only add the nullability the wire format uses; they
 * never restate the member lists, so a change in shared propagates here.
 */
export type ChefRole = ChefRoleValue | null;
export type SystemRole = SystemRoleValue | null;
export type PaymentStatus = PaymentStatusValue;
export type EntryStatus = EntryStatusValue;
export type RestaurantPlatform = RestaurantPlatformValue;

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
  pageInfo: {
    startCursor?: string | null;
    endCursor: string | null;
    hasPreviousPage?: boolean;
    hasNextPage: boolean;
  };
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

export type CollectionSystemType = CollectionSystemTypeValue | null;

export type Collection = GeneratedSchemas['Collection'];

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

export type RestaurantCollectionSummary = Pick<
  Collection,
  'id' | 'name' | 'description' | 'isPublic' | 'systemType' | 'ownerId'
>;

export type RestaurantDetailData = {
  restaurant: RestaurantEntry & { collections: RestaurantCollectionSummary[] };
  feedback: RestaurantFeedbackPage;
  collections: Collection[];
};

export type User = GeneratedSchemas['User'];

export type PaymentQrImage = {
  id: string;
  label: string;
  mimeType: string;
  sizeBytes: number;
  status: EntryStatus;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type ParticipantGroup = {
  id: string;
  name: string;
  ownerId: string;
  members: { userId: string; user: User }[];
  createdAt: string;
  updatedAt: string;
};

export type RestaurantEntry = GeneratedSchemas['RestaurantEntry'];

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
  items: { code: string; name: string; aliases?: string[] }[];
  stale: boolean;
};

export type BillParticipant = Bill['participants'][number];

export type Bill = GeneratedSchemas['Bill'];

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

  /** OpenAPI-driven client for endpoint-by-endpoint typed transport adoption. */
  transport() {
    return createTransportClient(API_URL, this.token);
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const isFormData =
      typeof FormData !== 'undefined' && init.body instanceof FormData;
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(init.body && !isFormData
          ? { 'Content-Type': 'application/json' }
          : {}),
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
