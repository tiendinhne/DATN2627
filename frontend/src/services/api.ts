/**
 * Base API client and request helpers for NestJS backend integration.
 * Khớp chuẩn endpoints và xử lý lỗi theo backend (docs/api/endpoint.md).
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Gọi API kèm token; lỗi thì ném Error với message backend trả về.
export async function request<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Lỗi validate của class-validator trả message dạng mảng
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message || `Lỗi ${res.status}`);
  }

  // 204 không có body
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body && (Array.isArray(body.message) ? body.message.join(', ') : body.message);
    throw new Error(message || `API Error [${response.status}]`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export default apiClient;
