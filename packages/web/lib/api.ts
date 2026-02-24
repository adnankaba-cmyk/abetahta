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

class ApiClient {
  #baseUrl: string;

  constructor(baseUrl: string) {
    this.#baseUrl = baseUrl;
  }

  #getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  }

  async #request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
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
