export class RequestTimeoutError extends Error {
  constructor(operation: string, timeoutMs: number) {
    super(`${operation} timed out after ${timeoutMs}ms.`);
    this.name = 'RequestTimeoutError';
  }
}

export class HttpRequestError extends Error {
  public readonly status: number;

  constructor(
    status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpRequestError';
    this.status = status;
  }
}

interface FetchJsonOptions extends RequestInit {
  operation: string;
  timeoutMs: number;
}

export async function fetchJsonWithTimeout<TValue>(
  url: string | URL,
  options: FetchJsonOptions,
): Promise<TValue> {
  const { operation, timeoutMs, ...init } = options;
  const response = await fetchWithTimeout(url, {
    ...init,
    operation,
    timeoutMs,
  });

  if (!response.ok) {
    throw await buildHttpRequestError(response, operation);
  }

  return (await response.json()) as TValue;
}

export async function fetchWithTimeout(
  url: string | URL,
  options: RequestInit & { operation: string; timeoutMs: number },
): Promise<Response> {
  const { operation, timeoutMs, ...init } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new RequestTimeoutError(operation, timeoutMs);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function buildHttpRequestError(response: Response, operation: string) {
  const fallback = `${operation} failed with status ${response.status}.`;

  try {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as { message?: string };
      return new HttpRequestError(response.status, payload.message?.trim() || fallback);
    }

    const body = (await response.text()).trim();
    return new HttpRequestError(response.status, body || fallback);
  } catch {
    return new HttpRequestError(response.status, fallback);
  }
}