const API_BASE = import.meta.env.VITE_API_URL || '/api';
const BLOCK_NOTICE_KEY = 'utkal_block_notice';
const DEFAULT_CACHE_TTL_MS = 8000;
const responseCache = new Map();
const inflightRequests = new Map();

function requestKey(path, method, token) {
  return `${method}:${token || 'guest'}:${path}`;
}

function getCachedEntry(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  if (method !== 'GET') return null;
  return responseCache.get(requestKey(path, method, getToken())) || null;
}

export function peekApiCache(path, options = {}) {
  const cached = getCachedEntry(path, options);
  if (!cached) return null;
  return {
    data: cached.data,
    updatedAt: cached.updatedAt,
    fresh: cached.expiresAt > Date.now()
  };
}

export function clearApiCache() {
  responseCache.clear();
}

export function getToken() {
  return localStorage.getItem('utkal_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('utkal_token', token);
  else localStorage.removeItem('utkal_token');
}

export function getBlockNotice() {
  return localStorage.getItem(BLOCK_NOTICE_KEY) || '';
}

export function setBlockNotice(message) {
  if (message) localStorage.setItem(BLOCK_NOTICE_KEY, message);
  else localStorage.removeItem(BLOCK_NOTICE_KEY);
}

export async function api(path, options = {}) {
  const token = getToken();
  const method = String(options.method || 'GET').toUpperCase();
  const cacheTtlMs = Math.max(0, Number(options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS));
  const useCache = method === 'GET' && options.cache !== false;
  const key = requestKey(path, method, token);
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  if (useCache && !options.forceFresh) {
    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
  }

  if (useCache && inflightRequests.has(key)) {
    return inflightRequests.get(key);
  }

  const requestPromise = (async () => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      method,
      headers,
      body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 423) {
        setBlockNotice(data.message || 'This panel has been blocked by the admin.');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('utkal:panel-blocked', { detail: data }));
        }
      }
      const error = new Error(data.message || 'Request failed.');
      error.status = response.status;
      error.data = data;
      throw error;
    }

    if (useCache && cacheTtlMs > 0) {
      responseCache.set(key, {
        data,
        updatedAt: Date.now(),
        expiresAt: Date.now() + cacheTtlMs
      });
    }

    if (method !== 'GET') {
      clearApiCache();
    }

    return data;
  })();

  if (useCache) {
    inflightRequests.set(key, requestPromise);
  }

  try {
    return await requestPromise;
  } finally {
    if (useCache) inflightRequests.delete(key);
  }
}

export const money = (value = 0) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

export const dateText = (value) =>
  value
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(value))
    : '-';
