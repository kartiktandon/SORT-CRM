import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomBytes } from 'node:crypto';
import { db } from './db.js';
import { hashPassword, verifyPassword, tokenHash, readSession } from './security.js';
import { resources, validate } from './resources.js';
import { verifyWebhook, handleWebhook, handleTestLead, getMetaStatus } from './meta.js';
import { createAllowedOrigins, isOriginAllowed } from './origins.js';
import {
  authorizationUrl,
  cancelCalendarMeeting,
  createCalendarMeeting,
  decryptToken,
  encryptToken,
  exchangeAuthorizationCode,
  getGoogleAccountEmail,
  hashOAuthState,
  meetLinkFromEvent,
  revokeGoogleToken,
  updateCalendarMeeting,
  validateGoogleCalendarConfig,
  validateMeetingInput,
} from './google-calendar.js';

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

// H-2: Canonical exact-match CORS — explicitly allow production domains plus
// comma-separated origins configured through FRONTEND_ORIGIN.
const allowedOrigins = createAllowedOrigins();
// Dev-only: allow localhost variants
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.add('http://localhost:3000');
  allowedOrigins.add('http://127.0.0.1:3000');
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests (no Origin header)
    if (isOriginAllowed(origin, allowedOrigins)) return callback(null, true);
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
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.path.startsWith('/api/webhooks') && !isOriginAllowed(req.headers.origin, allowedOrigins)) {
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

// This route intentionally does not query MySQL. It confirms that Vercel loaded
// the Express function; /api/health below separately verifies the database.
app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'novera-crm-api' });
});

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
// A well-formed fixed hash keeps unknown-user password checks timing-compatible
// without delaying every serverless cold start with module-level async work.
const dummyHash = `${'0'.repeat(32)}:${'0'.repeat(128)}`;

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

// ── Google Calendar and Meet integration ─────────────────────
const requireAdmin = (req, res) => {
  if (req.user.role === 'admin') return true;
  res.status(403).json({ error: 'Administrator access required.' });
  return false;
};
const frontendUrl = (path = '') => {
  const origin = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000').split(',')[0].trim().replace(/\/+$/, '');
  return `${origin}${path}`;
};
const googleConnection = async () => {
  const [rows] = await db.query('SELECT email,refresh_token_encrypted FROM google_calendar_connections WHERE id=1 LIMIT 1');
  if (!rows.length) {
    const error = new Error('Connect the company Google Calendar account before booking meetings.');
    error.status = 409;
    throw error;
  }
  return { email: rows[0].email, refreshToken: decryptToken(rows[0].refresh_token_encrypted) };
};
const publicMeeting = row => ({
  ...row,
  start_at: String(row.start_at).replace(' ', 'T') + (String(row.start_at).endsWith('Z') ? '' : 'Z'),
  end_at: String(row.end_at).replace(' ', 'T') + (String(row.end_at).endsWith('Z') ? '' : 'Z'),
  attendee_emails: typeof row.attendee_emails === 'string' ? JSON.parse(row.attendee_emails) : row.attendee_emails,
});

app.get('/api/integrations/google/status', asyncRoute(async (_req, res) => {
  const [rows] = await db.query('SELECT email,connected_at,updated_at FROM google_calendar_connections WHERE id=1 LIMIT 1');
  res.json({ connected: Boolean(rows.length), account: rows[0] || null });
}));

app.post('/api/integrations/google/connect', asyncRoute(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  validateGoogleCalendarConfig();
  const state = randomBytes(32).toString('hex');
  await db.execute('DELETE FROM google_oauth_states WHERE expires_at<=NOW() OR user_id=?', [req.user.id]);
  await db.execute(
    'INSERT INTO google_oauth_states(state_hash,user_id,expires_at) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 10 MINUTE))',
    [hashOAuthState(state), req.user.id],
  );
  res.json({ url: authorizationUrl(state) });
}));

app.get('/api/integrations/google/callback', asyncRoute(async (req, res) => {
  const redirect = (status, message) => res.redirect(frontendUrl(`/?google=${status}&message=${encodeURIComponent(message)}`));
  if (typeof req.query.state !== 'string') return redirect('error', 'The Google authorization response was invalid.');
  const stateHash = hashOAuthState(req.query.state);
  const [states] = await db.execute(
    'SELECT user_id FROM google_oauth_states WHERE state_hash=? AND user_id=? AND expires_at>NOW() LIMIT 1',
    [stateHash, req.user.id],
  );
  if (!states.length) return redirect('error', 'The Google authorization request expired. Please try again.');
  await db.execute('DELETE FROM google_oauth_states WHERE state_hash=?', [stateHash]);
  if (typeof req.query.error === 'string') return redirect('error', 'Google authorization was cancelled.');
  if (typeof req.query.code !== 'string') return redirect('error', 'The Google authorization response was invalid.');
  try {
    const tokens = await exchangeAuthorizationCode(req.query.code);
    if (!tokens.refresh_token) return redirect('error', 'Google did not return offline access. Disconnect access in Google and try again.');
    const email = await getGoogleAccountEmail(tokens.refresh_token);
    if (!email) return redirect('error', 'Could not read the connected Google account email.');
    await db.execute(
      `INSERT INTO google_calendar_connections(id,email,refresh_token_encrypted,scope,connected_by)
       VALUES(1,?,?,?,?) ON DUPLICATE KEY UPDATE email=VALUES(email),refresh_token_encrypted=VALUES(refresh_token_encrypted),scope=VALUES(scope),connected_by=VALUES(connected_by),connected_at=CURRENT_TIMESTAMP`,
      [email, encryptToken(tokens.refresh_token), tokens.scope || '', req.user.id],
    );
    return redirect('connected', `Connected ${email}.`);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return redirect(
      'error',
      error.expose ? error.message : 'Google Calendar could not be connected.',
    );
  }
}));

app.post('/api/integrations/google/disconnect', asyncRoute(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const [rows] = await db.query('SELECT refresh_token_encrypted FROM google_calendar_connections WHERE id=1 LIMIT 1');
  if (rows.length) {
    const refreshToken = decryptToken(rows[0].refresh_token_encrypted);
    await revokeGoogleToken(refreshToken).catch(error => console.warn('Google token revocation note:', error.message));
    await db.execute('DELETE FROM google_calendar_connections WHERE id=1');
  }
  res.sendStatus(204);
}));

app.get('/api/meetings', asyncRoute(async (_req, res) => {
  const [rows] = await db.query('SELECT * FROM meetings ORDER BY start_at ASC LIMIT 2000');
  res.json({ data: rows.map(publicMeeting) });
}));

app.post('/api/meetings', asyncRoute(async (req, res) => {
  const meeting = validateMeetingInput(req.body);
  const idempotencyKey = String(req.headers['idempotency-key'] || '').trim();
  if (idempotencyKey && (idempotencyKey.length > 100 || !/^[\w.-]+$/.test(idempotencyKey)))
    return res.status(400).json({ error: 'Invalid idempotency key.' });
  if (idempotencyKey) {
    const [existing] = await db.execute('SELECT * FROM meetings WHERE idempotency_key=? LIMIT 1', [idempotencyKey]);
    if (existing.length) return res.json({ data: publicMeeting(existing[0]) });
  }
  const { refreshToken } = await googleConnection();
  const googleEventId = randomBytes(16).toString('hex');
  const event = await createCalendarMeeting(refreshToken, meeting, googleEventId);
  try {
    const [result] = await db.execute(
      `INSERT INTO meetings(google_event_id,title,description,start_at,end_at,time_zone,attendee_emails,meet_url,calendar_url,status,created_by,idempotency_key)
       VALUES(?,?,?,?,?,?,?,?,?,'scheduled',?,?)`,
      [event.id, meeting.title, meeting.description, meeting.start_at, meeting.end_at, meeting.time_zone, JSON.stringify(meeting.attendee_emails), meetLinkFromEvent(event), event.htmlLink || '', req.user.id, idempotencyKey || null],
    );
    const [rows] = await db.execute('SELECT * FROM meetings WHERE id=?', [result.insertId]);
    res.status(201).json({ data: publicMeeting(rows[0]) });
  } catch (error) {
    await cancelCalendarMeeting(refreshToken, event.id).catch(() => {});
    throw error;
  }
}));

app.patch('/api/meetings/:id', asyncRoute(async (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid meeting ID.' });
  const [rows] = await db.execute('SELECT * FROM meetings WHERE id=? LIMIT 1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Meeting not found.' });
  if (rows[0].status === 'cancelled') return res.status(409).json({ error: 'A cancelled meeting cannot be changed.' });
  const merged = {
    title: req.body?.title ?? rows[0].title,
    description: req.body?.description ?? rows[0].description,
    start_at: req.body?.start_at ?? rows[0].start_at,
    end_at: req.body?.end_at ?? rows[0].end_at,
    time_zone: req.body?.time_zone ?? rows[0].time_zone,
    attendee_emails: req.body?.attendee_emails ?? (typeof rows[0].attendee_emails === 'string' ? JSON.parse(rows[0].attendee_emails) : rows[0].attendee_emails),
  };
  const meeting = validateMeetingInput(merged);
  const { refreshToken } = await googleConnection();
  const event = await updateCalendarMeeting(refreshToken, rows[0].google_event_id, meeting);
  await db.execute(
    'UPDATE meetings SET title=?,description=?,start_at=?,end_at=?,time_zone=?,attendee_emails=?,meet_url=?,calendar_url=? WHERE id=?',
    [meeting.title, meeting.description, meeting.start_at, meeting.end_at, meeting.time_zone, JSON.stringify(meeting.attendee_emails), meetLinkFromEvent(event) || rows[0].meet_url, event.htmlLink || rows[0].calendar_url, req.params.id],
  );
  const [updated] = await db.execute('SELECT * FROM meetings WHERE id=?', [req.params.id]);
  res.json({ data: publicMeeting(updated[0]) });
}));

app.delete('/api/meetings/:id', asyncRoute(async (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid meeting ID.' });
  const [rows] = await db.execute('SELECT * FROM meetings WHERE id=? LIMIT 1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Meeting not found.' });
  if (rows[0].status !== 'cancelled') {
    const { refreshToken } = await googleConnection();
    await cancelCalendarMeeting(refreshToken, rows[0].google_event_id);
    await db.execute("UPDATE meetings SET status='cancelled',cancelled_at=NOW() WHERE id=?", [req.params.id]);
  }
  res.sendStatus(204);
}));

// ── Bootstrap (Parallelized for sub-second performance) ───────
const publicUsers = 'id,name,email,role,job_title,status,phone,IF(password_hash IS NULL,0,1) AS has_login,created_at,updated_at';
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
          : resource === 'reports' ? 'weekly_reports'
            : resource === 'lead_notes' ? 'note' : 'name';
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
    if (resource === 'users') {
      data.email = data.email.toLowerCase();
      data.password_hash = await hashPassword(data.password);
      delete data.password;
    }
    if (resource === 'lead_notes') {
      data.user_id = req.user.id;
      data.user_name = req.user.name;
    }
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
    if (resource === 'lead_notes')
      return res.status(405).json({ error: 'Notes cannot be edited after they are added.' });
    const data = validate(resource, req.body);
    if (resource === 'users') {
      if (data.email) data.email = data.email.toLowerCase();
      if (data.password) {
        data.password_hash = await hashPassword(data.password);
        delete data.password;
      }
    }
    const [result] = await db.query(`UPDATE \`${resource}\` SET ? WHERE id=?`, [data, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Record not found.' });
    if (resource === 'users' && data.password_hash)
      await db.execute('DELETE FROM sessions WHERE user_id=?', [req.params.id]);
    const [rows] = await db.execute(
      `SELECT ${resource === 'users' ? publicUsers : '*'} FROM \`${resource}\` WHERE id=?`,
      [req.params.id]
    );
    res.json({ data: rows[0] });
  }));

  app.delete(`/api/${resource}/:id`, asyncRoute(async (req, res) => {
    if (resource === 'lead_notes')
      return res.status(405).json({ error: 'Notes cannot be deleted.' });
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

  // M-3: Return only intentional user-facing errors. Known operational 5xx
  // errors must opt in with `expose`; unexpected infrastructure details stay hidden.
  if (error.status && ((error.status >= 400 && error.status < 500) || error.expose === true)) {
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
