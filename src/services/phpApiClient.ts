type ApiError = { message: string };

type QueryResult<T = unknown> = {
  data: T | null;
  error: ApiError | null;
  count?: number;
};

type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

type AuthSession = {
  access_token: string;
  user: {
    id: string;
    email: string;
    created_at?: string;
    is_anonymous?: boolean;
  };
};

const API_BASE_URL = import.meta.env.VITE_CPANEL_API_URL || 'https://taxpal.gmd-networks.com.ng/api';
const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';

const authListeners = new Set<(event: string, session: AuthSession | null) => void>();

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  return fallback;
}

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function getStoredToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function getStoredUser() {
  return safeJsonParse<AuthSession['user']>(localStorage.getItem(AUTH_USER_KEY));
}

function getSession(): AuthSession | null {
  const token = getStoredToken();
  const user = getStoredUser();
  if (!token || !user) return null;
  return {
    access_token: token,
    user,
  };
}

function persistSession(session: AuthSession | null) {
  if (!session) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    return;
  }

  localStorage.setItem(AUTH_TOKEN_KEY, session.access_token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user));
}

function emitAuthChange(event: string, session: AuthSession | null) {
  for (const listener of authListeners) {
    listener(event, session);
  }
}

async function request<T = unknown>(
  path: string,
  options: RequestInit = {},
  extraHeaders: Record<string, string> = {}
): Promise<{ ok: boolean; status: number; json: T | null; text: string }> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let json: T | null = null;
  try {
    json = text ? (JSON.parse(text) as T) : null;
  } catch {
    json = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    json,
    text,
  };
}

class PhpRealtimeChannel {
  private isSubscribed = false;

  on(_event: string, _filter: Record<string, unknown>, _callback: (payload: unknown) => void) {
    return this;
  }

  subscribe() {
    this.isSubscribed = true;
    return this;
  }

  unsubscribe() {
    this.isSubscribed = false;
  }

  get subscribed() {
    return this.isSubscribed;
  }
}

class QueryBuilder<T = unknown> implements PromiseLike<QueryResult<T>> {
  private operation: 'select' | 'update' | 'delete' = 'select';
  private selectColumns = '*';
  private countMode?: 'exact';
  private headMode = false;
  private filters: Array<{ column: string; op: FilterOp; value: unknown }> = [];
  private orderBy: Array<{ column: string; ascending: boolean }> = [];
  private limitValue?: number;
  private updatePayload: Record<string, unknown> = {};
  private expectSingle: 'single' | 'maybeSingle' | null = null;

  constructor(private readonly table: string) {}

  select(columns = '*', options?: { count?: 'exact'; head?: boolean }) {
    this.operation = 'select';
    this.selectColumns = columns;
    this.countMode = options?.count;
    this.headMode = !!options?.head;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, op: 'eq', value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ column, op: 'neq', value });
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push({ column, op: 'gt', value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ column, op: 'gte', value });
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push({ column, op: 'lt', value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ column, op: 'lte', value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.operation = 'update';
    this.updatePayload = payload;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  single() {
    this.expectSingle = 'single';
    return this;
  }

  maybeSingle() {
    this.expectSingle = 'maybeSingle';
    return this;
  }

  async insert(payload: Record<string, unknown> | Array<Record<string, unknown>>): Promise<QueryResult<unknown>> {
    try {
      const res = await request<{ data?: unknown; error?: string }>(`/data/${this.table}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        return {
          data: null,
          error: { message: res.json?.error || `Request failed with status ${res.status}` },
        };
      }

      return { data: res.json?.data ?? null, error: null };
    } catch (error: unknown) {
      return { data: null, error: { message: getErrorMessage(error, 'Insert failed') } };
    }
  }

  async upsert(
    payload: Record<string, unknown> | Array<Record<string, unknown>>,
    _options?: { onConflict?: string }
  ): Promise<QueryResult<unknown>> {
    return this.insert(payload);
  }

  private buildQuery() {
    const params = new URLSearchParams();

    if (this.selectColumns) {
      params.set('select', this.selectColumns);
    }

    if (this.countMode) {
      params.set('count', this.countMode);
    }

    if (this.headMode) {
      params.set('head', 'true');
    }

    if (this.orderBy.length > 0) {
      params.set(
        'order',
        this.orderBy.map((item) => `${item.column}.${item.ascending ? 'asc' : 'desc'}`).join(',')
      );
    }

    if (typeof this.limitValue === 'number') {
      params.set('limit', String(this.limitValue));
    }

    for (const filter of this.filters) {
      params.set(`filter[${filter.column}]`, `${filter.op}.${String(filter.value)}`);
    }

    return params.toString();
  }

  private normalizeSelectResult(rawData: unknown): unknown {
    if (this.expectSingle === 'single') {
      if (Array.isArray(rawData)) {
        return rawData.length > 0 ? rawData[0] : null;
      }
      return rawData;
    }

    if (this.expectSingle === 'maybeSingle') {
      if (Array.isArray(rawData)) {
        return rawData.length > 0 ? rawData[0] : null;
      }
      return rawData ?? null;
    }

    return rawData;
  }

  private async execute(): Promise<QueryResult<T>> {
    try {
      const query = this.buildQuery();
      const path = `/data/${this.table}${query ? `?${query}` : ''}`;

      if (this.operation === 'select') {
        const res = await request<{ data?: unknown; error?: string; count?: number }>(path, { method: 'GET' });

        if (!res.ok) {
          return {
            data: null,
            error: { message: res.json?.error || `Request failed with status ${res.status}` },
          };
        }

        if (this.headMode && this.countMode === 'exact') {
          return {
            data: null,
            error: null,
            count: res.json?.count ?? 0,
          };
        }

        const normalized = this.normalizeSelectResult(res.json?.data ?? null);

        if (this.expectSingle === 'single' && !normalized) {
          return {
            data: null,
            error: { message: 'No rows returned' },
          };
        }

        return {
          data: normalized as T | null,
          error: null,
          count: res.json?.count,
        };
      }

      if (this.operation === 'update') {
        const res = await request<{ data?: unknown; error?: string }>(path, {
          method: 'PUT',
          body: JSON.stringify(this.updatePayload),
        });

        if (!res.ok) {
          return {
            data: null,
            error: { message: res.json?.error || `Request failed with status ${res.status}` },
          };
        }

        return { data: (res.json?.data ?? null) as T | null, error: null };
      }

      const res = await request<{ data?: unknown; error?: string }>(path, { method: 'DELETE' });

      if (!res.ok) {
        return {
          data: null,
          error: { message: res.json?.error || `Request failed with status ${res.status}` },
        };
      }

      return { data: (res.json?.data ?? null) as T | null, error: null };
    } catch (error: unknown) {
      return { data: null, error: { message: getErrorMessage(error, 'Request failed') } };
    }
  }

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class PhpApiClient {
  from<T = unknown>(table: string) {
    return new QueryBuilder<T>(table);
  }

  channel(_name: string) {
    return new PhpRealtimeChannel();
  }

  removeChannel(channel: PhpRealtimeChannel) {
    channel.unsubscribe();
    return true;
  }

  auth = {
    getSession: async () => {
      return {
        data: {
          session: getSession(),
        },
        error: null,
      };
    },

    getUser: async () => {
      const session = getSession();
      return {
        data: {
          user: session?.user ?? null,
        },
        error: null,
      };
    },

    onAuthStateChange: (callback: (event: string, session: AuthSession | null) => void) => {
      authListeners.add(callback);

      setTimeout(() => {
        callback('INITIAL_SESSION', getSession());
      }, 0);

      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(callback);
            },
          },
        },
      };
    },

    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      try {
        const res = await request<{ data?: { user: AuthSession['user']; token: string }; error?: string }>(
          '/auth/login',
          {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          }
        );

        if (!res.ok || !res.json?.data?.token || !res.json?.data?.user) {
          return {
            data: { user: null, session: null },
            error: { message: res.json?.error || 'Invalid credentials' },
          };
        }

        const session: AuthSession = {
          access_token: res.json.data.token,
          user: {
            ...res.json.data.user,
            is_anonymous: false,
          },
        };

        persistSession(session);
        emitAuthChange('SIGNED_IN', session);

        return {
          data: { user: session.user, session },
          error: null,
        };
      } catch (error: unknown) {
        return {
          data: { user: null, session: null },
          error: { message: getErrorMessage(error, 'Sign in failed') },
        };
      }
    },

    signUp: async ({ email, password }: { email: string; password: string }) => {
      try {
        const res = await request<{ data?: { user: AuthSession['user']; token: string }; error?: string }>(
          '/auth/register',
          {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          }
        );

        if (!res.ok || !res.json?.data?.token || !res.json?.data?.user) {
          return {
            data: { user: null, session: null },
            error: { message: res.json?.error || 'Sign up failed' },
          };
        }

        const session: AuthSession = {
          access_token: res.json.data.token,
          user: {
            ...res.json.data.user,
            is_anonymous: false,
          },
        };

        persistSession(session);
        emitAuthChange('SIGNED_IN', session);

        return {
          data: { user: session.user, session },
          error: null,
        };
      } catch (error: unknown) {
        return {
          data: { user: null, session: null },
          error: { message: getErrorMessage(error, 'Sign up failed') },
        };
      }
    },

    signOut: async () => {
      persistSession(null);
      emitAuthChange('SIGNED_OUT', null);
      return { error: null };
    },
  };

  functions = {
    invoke: async (
      functionName: string,
      options?: {
        body?: Record<string, unknown>;
        headers?: Record<string, string>;
        method?: string;
      }
    ) => {
      try {
        const method = options?.method || 'POST';
        const res = await request<{ data?: unknown; error?: string; [key: string]: unknown }>(
          `/functions/${functionName}`,
          {
            method,
            body: options?.body ? JSON.stringify(options.body) : undefined,
          },
          options?.headers || {}
        );

        if (!res.ok) {
          return {
            data: null,
            error: { message: res.json?.error || `Function failed with status ${res.status}` },
          };
        }

        return {
          data: (res.json?.data ?? res.json) || null,
          error: null,
        };
      } catch (error: unknown) {
        return {
          data: null,
          error: { message: getErrorMessage(error, 'Function invocation failed') },
        };
      }
    },
  };
}

export const phpApiClient = new PhpApiClient();
export const PHP_API_BASE = API_BASE_URL;
