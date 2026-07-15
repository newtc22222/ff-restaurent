export type AddressDirectoryItem = {
  code: string;
  name: string;
};

export type AddressDirectoryResult = {
  items: AddressDirectoryItem[];
  stale: boolean;
};

type UpstreamArea = {
  code?: unknown;
  name?: unknown;
  wards?: unknown;
};

type CacheEntry = {
  items: AddressDirectoryItem[];
  fetchedAt: number;
};

export class AddressDirectoryUnavailableError extends Error {
  readonly statusCode = 503;
  readonly code = 'ADDRESS_DIRECTORY_UNAVAILABLE';

  constructor() {
    super('The Vietnamese address directory is temporarily unavailable');
  }
}

export type AddressDirectoryOptions = {
  baseUrl: string;
  timeoutMs: number;
  cacheTtlMs: number;
  fetcher?: typeof fetch;
  now?: () => number;
};

const normalizeItems = (value: unknown): AddressDirectoryItem[] => {
  if (!Array.isArray(value)) throw new Error('Expected an address-area list');
  return value.map((entry) => {
    const area = entry as UpstreamArea;
    if (
      (typeof area.code !== 'number' && typeof area.code !== 'string') ||
      typeof area.name !== 'string'
    ) {
      throw new Error('Invalid address-area entry');
    }
    return { code: String(area.code), name: area.name.trim() };
  });
};

/**
 * Application-owned adapter for the external Vietnamese province API. Cached
 * data remains usable when the upstream is slow or unavailable.
 */
export class AddressDirectory {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly options: AddressDirectoryOptions) {
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? Date.now;
  }

  getProvinces() {
    return this.get('provinces', '', (payload) => normalizeItems(payload));
  }

  getWards(provinceCode: string) {
    return this.get(
      `wards:${provinceCode}`,
      `p/${provinceCode}?depth=2`,
      (payload) => {
        const province = payload as UpstreamArea;
        return normalizeItems(province.wards);
      },
    );
  }

  private async get(
    key: string,
    path: string,
    normalize: (payload: unknown) => AddressDirectoryItem[],
  ): Promise<AddressDirectoryResult> {
    const cached = this.cache.get(key);
    if (cached && this.now() - cached.fetchedAt < this.options.cacheTtlMs) {
      return { items: cached.items, stale: false };
    }

    try {
      const response = await this.fetcher(`${this.options.baseUrl}${path}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
      if (!response.ok)
        throw new Error(`Address API returned ${response.status}`);
      const items = normalize(await response.json());
      this.cache.set(key, { items, fetchedAt: this.now() });
      return { items, stale: false };
    } catch {
      if (cached) return { items: cached.items, stale: true };
      throw new AddressDirectoryUnavailableError();
    }
  }
}
