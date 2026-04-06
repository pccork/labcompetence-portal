const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export interface ApiErrorPayload {
  message?: string;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
) {
  const shouldSendJsonContentType =
    options.body !== undefined &&
    options.body !== null &&
    !(
      options.body instanceof FormData ||
      options.body instanceof URLSearchParams ||
      options.body instanceof Blob
    );

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(shouldSendJsonContentType
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const payload = (await response.json()) as T & ApiErrorPayload;

  if (!response.ok) {
    throw new Error(payload.message || "Request failed");
  }

  return payload;
}
