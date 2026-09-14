export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'same-origin',
      headers,
    });
  } catch {
    throw new ApiError(
      'Cannot reach the CRM API. Start the backend and try again.',
      503,
    );
  }
  if (response.status === 204) return undefined as T;
  const body = await response
    .json()
    .catch(() => ({ error: 'The CRM API is unavailable.' }));
  if (!response.ok)
    throw new ApiError(
      body &&
        typeof body === 'object' &&
        'error' in body &&
        typeof body.error === 'string'
        ? body.error
        : 'Request failed.',
      response.status,
    );
  return body as T;
}
