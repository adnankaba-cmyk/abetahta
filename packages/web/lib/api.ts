const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Token yenileme sırasında gelen istekleri kuyruğa al
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

function drainQueue(token: string | null) {
  refreshQueue.forEach(fn => fn(token));
  refreshQueue = [];
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { accessToken: string; refreshToken: string };
    localStorage.setItem('refreshToken', data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

class ApiClient {
  #baseUrl: string;
  #token: string | null = null;

  constructor(baseUrl: string) {
    this.#baseUrl = baseUrl;
  }

  /** Auth store login/logout sonrası çağrılır — localStorage'a yazılmaz */
  setToken(token: string | null): void {
    this.#token = token;
  }

  #getToken(): string | null {
    return this.#token;
  }

  async #request<T = unknown>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
    const token = this.#getToken();
    const url = path.startsWith('http') ? path : `${this.#baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) ?? {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    // 401 aldık ve henüz retry denememedik — token yenilemeyi dene
    if (response.status === 401 && !isRetry) {
      if (isRefreshing) {
        // Başka bir refresh zaten devam ediyor — kuyruğa gir
        return new Promise<T>((resolve, reject) => {
          refreshQueue.push(async (newToken) => {
            if (!newToken) {
              reject(new ApiError('Oturum süresi doldu', 401));
              return;
            }
            try {
              resolve(await this.#request<T>(path, options, true));
            } catch (err) {
              reject(err);
            }
          });
        });
      }

      isRefreshing = true;
      const newToken = await refreshAccessToken();
      isRefreshing = false;
      drainQueue(newToken);

      if (!newToken) {
        // Refresh başarısız — login sayfasına yönlendir
        if (typeof window !== 'undefined') {
          localStorage.removeItem('refreshToken');
          this.#token = null;
          window.location.href = '/login';
        }
        throw new ApiError('Oturum süresi doldu, lütfen tekrar giriş yapın', 401);
      }

      this.#token = newToken;
      return this.#request<T>(path, options, true);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
      const message = (errorData.error as string) ?? `HTTP ${response.status}`;
      throw new ApiError(message, response.status, errorData);
    }

    return response.json() as Promise<T>;
  }

  get<T = unknown>(path: string): Promise<T> {
    return this.#request<T>(path);
  }

  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.#request<T>(path, {
      method: 'POST',
      body: body != null ? JSON.stringify(body) : undefined,
    });
  }

  put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.#request<T>(path, {
      method: 'PUT',
      body: body != null ? JSON.stringify(body) : undefined,
    });
  }

  del<T = unknown>(path: string): Promise<T> {
    return this.#request<T>(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient(API_URL);
