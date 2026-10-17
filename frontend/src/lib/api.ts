let csrfToken = '';
export class ApiError extends Error {
  status: number;
  fields: Record<string, string[]>;
  constructor(status: number, data: unknown) {
    const entries =
      typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
    const fields = Object.fromEntries(
      Object.entries(entries).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.map(String) : [String(value)],
      ]),
    );
    const message = Object.entries(fields)
      .map(
        ([key, value]) =>
          `${key === 'detail' || key === 'non_field_errors' ? '' : key.replaceAll('_', ' ') + ': '}${value.join(' ')}`,
      )
      .join(' ');
    super(message || 'Something went wrong. Please try again.');
    this.status = status;
    this.fields = fields;
  }
}

export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (method !== 'GET' && !csrfToken) {
    const result = await api<{ csrfToken: string }>('/auth/csrf/');
    csrfToken = result.csrfToken;
  }
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(method !== 'GET' ? { 'X-CSRFToken': csrfToken } : {}),
      },
      ...(body !== undefined
        ? { body: body instanceof FormData ? body : JSON.stringify(body) }
        : {}),
    });
  } catch {
    throw new Error('We could not reach the community. Check your connection and try again.');
  }
  if (response.status === 204) return undefined as T;
  const data = await response
    .json()
    .catch(() => ({ detail: 'The server is unavailable. Please try again.' }));
  if (data.csrfToken) csrfToken = data.csrfToken;
  if (!response.ok) {
    if (response.status === 403) csrfToken = '';
    throw new ApiError(response.status, data);
  }
  return data as T;
}
