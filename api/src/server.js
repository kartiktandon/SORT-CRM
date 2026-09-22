import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomBytes } from 'node:crypto';
import { db, connectionOptions } from './db.js';
import { hashPassword, verifyPassword, tokenHash, readSession } from './security.js';
import { resources, validate } from './resources.js';
import { verifyWebhook, handleWebhook, handleTestLead, getMetaStatus } from './meta.js';

const app = express();

// H-3/M-1: Trust the first proxy hop so req.ip reflects real client IP on Vercel
app.set('trust proxy', 1);

app.disable('x-powered-by');

// H-1: Security headers via helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc:    ["'self'", 'https:'],
      frameSrc:   ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// H-2: Exact-match CORS — explicitly allow production domains + any configured in FRONTEND_ORIGIN
const allowedOrigins = new Set([
  'https://crm.buildwithnovera.com',
  'https://buildwithnovera.com',
  'https://novera-crm-backend.vercel.app',
  ...(process.env.FRONTEND_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)
]);
// Dev-only: allow localhost variants
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.add('http://localhost:3000');
  allowedOrigins.add('http://127.0.0.1:3000');
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests (no Origin header)
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));

// Webhook route needs raw body for HMAC verification (C-1) — register BEFORE express.json()
app.use('/api/webhooks/facebook', (req, res, next) => {
  if (req.method === 'POST') {
    express.raw({ type: '*/*' })(req, res, (err) => {
      if (err) return next(err);
      // Store raw body; then also parse as JSON for downstream handlers
      req.rawBody = req.body;
      try {
        req.body = req.body && req.body.length ? JSON.parse(req.body.toString()) : {};
      } catch {
        req.body = {};
      }
      next();
    });
  } else {
    next();
  }
});

app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  // Secondary CORS enforcement for state-changing non-webhook requests
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.path.startsWith('/api/webhooks') && req.headers.origin && !allowedOrigins.has(req.headers.origin)) {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }
  next();
});

// L-1: Validate COOKIE_SAMESITE env var at startup
const SAMESITE_VALUE = process.env.COOKIE_SAMESITE || 'lax';
if (!['strict', 'lax', 'none'].includes(SAMESITE_VALUE)) {
  throw new Error(`[Startup] Invalid COOKIE_SAMESITE value: "${SAMESITE_VALUE}". Must be strict, lax, or none.`);
}
if (SAMESITE_VALUE === 'none') {
  console.warn('[Security] COOKIE_SAMESITE=none — ensure CSRF protection is in place for all state-changing routes.');
}

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const getCookieOptions = (req) => {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  return {
    httpOnly: true,
    sameSite: SAMESITE_VALUE,
    secure: isHttps && process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  };
};

const initExpensesTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(180) NOT NULL,
        category VARCHAR(80) DEFAULT 'Other',
        amount DECIMAL(12,2) NOT NULL,
        date DATE,
        payment_method VARCHAR(80),
        status ENUM('Pending','Approved','Paid','Rejected') DEFAULT 'Paid',
        vendor VARCHAR(160),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.warn('Expenses table initialization note:', err.message);
  }
};
// initExpensesTable is available for setup / health check, not executed on every serverless cold start
export { initExpensesTable };

// C-4: Health endpoint — no internal infra details exposed
app.get('/api/health', asyncRoute(async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    // Never expose DB host, user, error code, or message to callers
    res.status(503).json({ ok: false, error: 'Service unavailable.' });
  }
}));

// ── Meta (Facebook & Instagram) Lead Ads Webhooks ────────────
// These must remain before the auth middleware since Meta posts without a session
app.get('/api/webhooks/facebook', verifyWebhook);
app.post('/api/webhooks/facebook', asyncRoute(handleWebhook));

// ── Login with rate limiting ────────────────────────────────
const dummyHash = await hashPassword(randomBytes(24).toString('hex'));

// H-3: Use express-rate-limit (trust proxy set above makes req.ip accurate)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  handler: (_req, res) => res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' }),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // don't count successful logins against the limit
  validate: { xForwardedForHeader: false, default: true },
});

app.post('/api/auth/login', loginLimiter, asyncRoute(async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || email.length > 190 || password.length > 1024)
    return res.status(400).json({ error: 'Enter an email and password.' });

  const [rows] = await db.execute(
    'SELECT id,name,email,role,password_hash FROM users WHERE email=? AND status=? LIMIT 1',
    [email.trim().toLowerCase(), 'active']
  );
  const user = rows[0];
  const valid = await verifyPassword(password, user?.password_hash || dummyHash);
  if (!valid || !user) {
    // L-2: Structured audit log for failed login
    console.warn(JSON.stringify({ event: 'login_failed', email: email.trim().toLowerCase(), ip: req.ip, ts: new Date().toISOString() }));
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }

  const token = randomBytes(32).toString('hex');
  await db.execute(
    'INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 8 HOUR))',
    [tokenHash(token), user.id]
  );
  // Dual auth resilience: set HttpOnly cookie AND return token for Bearer auth fallback
  res.cookie('crm_session', token, getCookieOptions(req));
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token });
}));

// ── Session authentication middleware ────────────────────────
app.use('/api', asyncRoute(async (req, res, next) => {
  const token = readSession(req);
  if (!/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({ error: 'Please sign in.' });
  const [rows] = await db.execute(
    'SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>NOW() AND u.status=?',
    [tokenHash(token), 'active']
  );
  if (!rows.length) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  req.user = rows[0];
  next();
}));

// ── Auth routes (behind auth middleware) ─────────────────────
app.get('/api/auth/me', (req, res) => res.json({ user: req.user }));

app.post('/api/auth/logout', asyncRoute(async (req, res) => {
  await db.execute('DELETE FROM sessions WHERE token_hash=?', [tokenHash(readSession(req))]);
  res.clearCookie('crm_session', { ...getCookieOptions(req), maxAge: undefined });
  res.sendStatus(204);
}));

// H-4: Test lead endpoint — admin only (now behind auth middleware)
app.post('/api/webhooks/facebook/test', asyncRoute(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
  return handleTestLead(req, res);
}));

// H-5: Meta integration status — now behind auth middleware (no unauthenticated access)
app.get('/api/integrations/meta/status', getMetaStatus);

// ── Bootstrap (Parallelized for sub-second performance) ───────
const publicUsers = 'id,name,email,role,job_title,status,phone,created_at,updated_at';
app.get('/api/bootstrap', asyncRoute(async (req, res) => {
  const resourceKeys = Object.keys(resources);

  // Execute all 9 resource queries and the documents query in parallel
  const [resourceResults, [documents]] = await Promise.all([
    Promise.all(resourceKeys.map(resource =>
      db.query(`SELECT ${resource === 'users' ? publicUsers : '*'} FROM \`${resource}\` ORDER BY id ASC LIMIT 2000`)
    )),
    db.query('SELECT document_key,payload,version FROM workspace_documents'),
  ]);

  const data = {};
  for (let i = 0; i < resourceKeys.length; i++) {
    data[resourceKeys[i]] = resourceResults[i][0];
  }

  data.documents = Object.fromEntries(
    documents.map(row => [row.document_key, {
      value: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      version: row.version,
    }])
  );
  res.json({ data, user: req.user });
}));

// ── Documents ────────────────────────────────────────────────
app.put('/api/documents/:key', asyncRoute(async (req, res) => {
  if (!/^(project-[1-9]\d*|agreement-draft|settings|assets)$/.test(req.params.key))
    return res.status(400).json({ error: 'Invalid document.' });
  const { value, version } = req.body || {};
  if (value === undefined || !Number.isSafeInteger(version) || version < 0)
    return res.status(400).json({ error: 'A document and version are required.' });
  if (req.params.key === 'settings' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Administrator access required.' });
  const payload = JSON.stringify(value);
  if (payload.length > 500000) return res.status(413).json({ error: 'Document is too large.' });
  if (version === 0) {
    try {
      await db.execute('INSERT INTO workspace_documents(document_key,payload,version) VALUES(?,?,1)', [req.params.key, payload]);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This record changed. Refresh before saving.' });
      throw error;
    }
  } else {
    const [result] = await db.execute(
      'UPDATE workspace_documents SET payload=?,version=version+1 WHERE document_key=? AND version=?',
      [payload, req.params.key, version]
    );
    if (!result.affectedRows) return res.status(409).json({ error: 'This record changed. Refresh before saving.' });
  }
  res.json({ value, version: version + 1 });
}));

// ── Generic CRUD ─────────────────────────────────────────────
for (const resource of Object.keys(resources)) {
  app.get(`/api/${resource}`, asyncRoute(async (req, res) => {
    const term = String(req.query.q || '').slice(0, 190);
    const column = resource === 'tasks' || resource === 'expenses' ? 'title'
      : resource === 'invoices' ? 'invoice_number'
        : resource === 'agreements' ? 'title'
          : resource === 'reports' ? 'weekly_reports' : 'name';
    const [rows] = await db.execute(
      `SELECT ${resource === 'users' ? publicUsers : '*'} FROM \`${resource}\` WHERE \`${column}\` LIKE ? ORDER BY id DESC LIMIT 2000`,
      [`%${term}%`]
    );
    res.json({ data: rows });
  }));

  app.post(`/api/${resource}`, asyncRoute(async (req, res) => {
    if (resource === 'users' && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Administrator access required.' });
    const data = validate(resource, req.body, true);
    const [result] = await db.query(`INSERT INTO \`${resource}\` SET ?`, data);
    const [rows] = await db.execute(
      `SELECT ${resource === 'users' ? publicUsers : '*'} FROM \`${resource}\` WHERE id=?`,
      [result.insertId]
    );
    res.status(201).json({ data: rows[0] });
  }));

  app.patch(`/api/${resource}/:id`, asyncRoute(async (req, res) => {
    if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid record ID.' });
    if (resource === 'users' && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Administrator access required.' });
    const data = validate(resource, req.body);
    const [result] = await db.query(`UPDATE \`${resource}\` SET ? WHERE id=?`, [data, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Record not found.' });
    const [rows] = await db.execute(
      `SELECT ${resource === 'users' ? publicUsers : '*'} FROM \`${resource}\` WHERE id=?`,
      [req.params.id]
    );
    res.json({ data: rows[0] });
  }));

  app.delete(`/api/${resource}/:id`, asyncRoute(async (req, res) => {
    if (resource !== 'leads' && resource !== 'expenses' && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Administrator access required.' });
    if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid record ID.' });
    if (resource === 'users' && Number(req.params.id) === req.user.id)
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    const [result] = await db.execute(`DELETE FROM \`${resource}\` WHERE id=?`, [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Record not found.' });
    res.sendStatus(204);
  }));
}

// ── Global error handler ─────────────────────────────────────
app.use((error, _req, res, _next) => {
  const code = error.code;
  if (code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A record with these details already exists.' });
  if (code === 'ER_NO_REFERENCED_ROW_2' || code === 'ER_ROW_IS_REFERENCED_2')
    return res.status(409).json({ error: 'Check the linked client, project, or team member.' });

  // M-3: For intentional user-facing errors (4xx), return the message safely
  if (error.status && error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ error: error.message });
  }

  // M-3: For all other errors, log full detail server-side only; return generic message
  console.error('API error:', error);
  res.status(503).json({ error: 'Something went wrong. Please try again.' });
});

export default app;

if (!process.env.VERCEL) {
  const server = app.listen(Number(process.env.PORT || 4000), '127.0.0.1', () =>
    console.log(`CRM API: http://127.0.0.1:${process.env.PORT || 4000}`)
  );
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => server.close(() => { db.end().finally(() => process.exit(0)); }));
}
