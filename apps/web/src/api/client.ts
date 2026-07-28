import { createTransportClient } from './generated/transport-client';
import type { User } from './types';

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
