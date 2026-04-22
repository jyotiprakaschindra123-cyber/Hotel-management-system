import app, { ensureDbConnection } from '../server/index.js';

function normalizePath(pathValue) {
  if (Array.isArray(pathValue)) return pathValue.filter(Boolean).join('/');
  return String(pathValue || '').replace(/^\/+|\/+$/g, '');
}

export default async function handler(req, res) {
  try {
    await ensureDbConnection();
  } catch (_error) {
    // The Express app's health and error routes already expose connection details.
  }

  const currentUrl = new URL(req.url || '/api', 'http://localhost');
  const forwardedPath = normalizePath(currentUrl.searchParams.getAll('path').length > 1 ? currentUrl.searchParams.getAll('path') : currentUrl.searchParams.get('path'));
  currentUrl.searchParams.delete('path');

  const queryString = currentUrl.searchParams.toString();
  req.url = `/api${forwardedPath ? `/${forwardedPath}` : ''}${queryString ? `?${queryString}` : ''}`;

  return app(req, res);
}
