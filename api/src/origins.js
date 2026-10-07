const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3000';

export function normalizeOrigin(value) {
  if (typeof value !== 'string' || !value.trim()) return null;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function createAllowedOrigins(configuredOrigins = process.env.FRONTEND_ORIGIN) {
  const origins = [
    'https://sort-crm.vercel.app',
    'https://sort-crm-frontend.vercel.app',
    'https://sort-crm-1fay.vercel.app',
    ...(configuredOrigins || DEFAULT_FRONTEND_ORIGIN).split(','),
  ];

  return new Set(origins.map(normalizeOrigin).filter(Boolean));
}

export function isOriginAllowed(origin, allowedOrigins) {
  // Requests without Origin are server-to-server or same-origin navigations.
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  return normalized !== null && allowedOrigins.has(normalized);
}