import { getApiBase, isApiCrossOrigin } from './resolveApiBase';

export class ApiError extends Error {
  code: string;
  status: number;
  payload: unknown;

  constructor(message: string, opts: { code: string; status: number; payload?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.code = opts.code;
    this.status = opts.status;
    this.payload = opts.payload;
  }
}

/** Сетевая ошибка до HTTP-ответа (обрыв, CORS, таймаут и т.п.). */
export function isNetworkApiError(e: unknown): boolean {
  return (
    e instanceof ApiError &&
    (e.code === 'network' || e.code === 'cors' || e.code === 'timeout' || e.status === 0)
  );
}

function corsHintMessage(): string {
  return (
    'Не удалось связаться с сервером (блокировка запроса браузером). ' +
    'Попробуйте позже или откройте приложение заново из меню бота или соцсети.'
  );
}

async function fetchOrThrow(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    if (e instanceof TypeError) {
      const msg = isApiCrossOrigin() ? corsHintMessage() : (
        'Не удалось связаться с сервером. Проверьте интернет или откройте раздел позже (ошибка сети или блокировка запроса).'
      );
      throw new ApiError(msg, {
        code: isApiCrossOrigin() ? 'cors' : 'network',
        status: 0,
        payload: e,
      });
    }
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ApiError('Превышено время ожидания ответа сервера. Попробуйте ещё раз.', {
        code: 'timeout',
        status: 0,
        payload: e,
      });
    }
    throw e;
  }
}

function parseJsonPayload(data: Record<string, unknown>, res: Response) {
  if (!res.ok) {
    const code = typeof data.error === 'string' ? data.error : 'http_error';
    const msg = typeof data.message === 'string' ? data.message : res.statusText;
    throw new ApiError(msg, { code, status: res.status, payload: data });
  }
}

export async function apiPostJson<T>(
  path: string,
  body: unknown,
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetchOrThrow(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  parseJsonPayload(data, res);
  return data as T;
}

export async function apiGetJson<T>(path: string, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetchOrThrow(url, { method: 'GET', headers });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  parseJsonPayload(data, res);
  return data as T;
}

export async function apiPatchJson<T>(
  path: string,
  body: unknown,
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetchOrThrow(url, { method: 'PATCH', headers, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  parseJsonPayload(data, res);
  return data as T;
}
