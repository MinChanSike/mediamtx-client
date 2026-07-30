import useAppStore from '@src/store/useAppStore';

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message?: string
  ) {
    super(message ?? `HTTP ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  serverUrl = useAppStore.getState().serverUrl
): Promise<T> {
  const baseUrl = serverUrl;
  const url = `${baseUrl}${path}`;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new ApiError(response.status, response.statusText);
  }

  return response.json() as Promise<T>;
}
