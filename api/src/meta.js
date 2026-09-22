import { db } from './db.js';
import { createHmac, timingSafeEqual } from 'node:crypto';

// C-3: Require META_VERIFY_TOKEN from env — no hardcoded fallback
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
if (!META_VERIFY_TOKEN) {
  // In production this is fatal; in dev warn clearly
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[Startup] META_VERIFY_TOKEN environment variable is required and not set.');
  } else {
    console.warn('[Startup] WARNING: META_VERIFY_TOKEN is not set. Webhook verification will fail.');
  }
}

const META_PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN || '';
// C-1: App Secret for HMAC-SHA256 webhook signature verification
const META_APP_SECRET = process.env.META_APP_SECRET || '';

/**
 * Handle Meta's GET verification handshake:
 * Meta sends hub.mode, hub.verify_token, and hub.challenge
 */
export function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
    console.log('[Meta Webhook] Verification successful!');
    return res.status(200).send(challenge);
  }

  console.warn('[Meta Webhook] Verification failed! Token mismatch or invalid mode.');
  return res.status(403).json({ error: 'Verification token mismatch or invalid mode.' });
}

/**
 * Fetch lead details from Meta Graph API
 */
export async function fetchMetaLeadDetails(leadgenId) {
  const token = (process.env.META_PAGE_ACCESS_TOKEN || META_PAGE_ACCESS_TOKEN || '').trim();
  if (!token) {
    throw new Error('META_PAGE_ACCESS_TOKEN is not configured in environment variables');
  }

  // M-6 (partial): Use Authorization header instead of URL query param to avoid token in server logs
  const url = `https://graph.facebook.com/v21.0/${leadgenId}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Meta Graph API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Parse Meta field_data array into clean CRM fields
 */
export function parseMetaFieldData(fieldDataArray = []) {
  const lead = {
    name: '',
    email: '',
    phone: '',
    company: '',
    city: '',
    notes: '',
  };

  const extraNotes = [];

  for (const item of fieldDataArray) {
    const key = (item.name || '').toLowerCase();
    const value = Array.isArray(item.values) ? item.values.join(', ') : item.values || '';

    if (!value) continue;

    if (key.includes('full_name') || key === 'name') {
      lead.name = value;
    } else if (key.includes('first_name')) {
      lead.name = lead.name ? `${value} ${lead.name}` : value;
    } else if (key.includes('last_name')) {
      lead.name = lead.name ? `${lead.name} ${value}` : value;
    } else if (key.includes('email')) {
      lead.email = value;
    } else if (key.includes('phone')) {
      lead.phone = value;
    } else if (key.includes('company')) {
      lead.company = value;
    } else if (key.includes('city')) {
      lead.city = value;
    } else {
      extraNotes.push(`${item.name}: ${value}`);
    }
  }

  if (!lead.name) {
    lead.name = lead.email ? lead.email.split('@')[0] : 'Facebook Lead';
  }

  if (extraNotes.length > 0) {
    lead.notes = extraNotes.join(' | ');
  }

  return lead;
}

/**
 * Insert a parsed lead directly into the CRM database
 */
export async function insertLeadIntoCrm({
  name,
  email = '',
  phone = '',
  company = '',
  city = '',
  source = 'Facebook Ad',
  platform = 'Facebook',
  status = 'New leads',
  estimated_value = 0,
  notes = '',
}) {
  const [result] = await db.query(
    `INSERT INTO leads (name, email, phone, company, city, source, platform, status, estimated_value, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name.slice(0, 120),
      (email || '').slice(0, 190),
      (phone || '').slice(0, 40),
      (company || '').slice(0, 160),
      (city || '').slice(0, 100),
      source.slice(0, 80),
      platform,
      status,
      Number(estimated_value) || 0,
      notes,
    ],
  );

  const [rows] = await db.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
  return rows[0];
}

/**
 * C-1: Verify Meta's X-Hub-Signature-256 HMAC signature on the raw request body.
 * Returns true if valid, false otherwise.
 */
function verifyHmacSignature(rawBody, signatureHeader) {
  if (!META_APP_SECRET) {
    // If no app secret configured, skip verification in dev but warn
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Meta Webhook] META_APP_SECRET not set — skipping HMAC verification (dev only).');
      return true;
    }
    return false;
  }
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  try {
    const expected = 'sha256=' + createHmac('sha256', META_APP_SECRET)
      .update(rawBody)
      .digest('hex');
    const sigBuf = Buffer.from(signatureHeader);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

/**
 * Handle Meta POST Webhook event
 */
export async function handleWebhook(req, res) {
  // C-1: Verify HMAC-SHA256 signature before processing anything
  const rawBody = req.rawBody || JSON.stringify(req.body);
  const signature = req.headers['x-hub-signature-256'];
  if (!verifyHmacSignature(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody), signature)) {
    console.warn('[Meta Webhook] Invalid or missing X-Hub-Signature-256 — rejecting request.');
    return res.status(403).send('Invalid signature');
  }

  // Always acknowledge immediately with 200 OK so Meta doesn't retry/time out
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;

    // L-5: Validate payload shape before iterating
    if (typeof body !== 'object' || !body || body.object !== 'page' || !Array.isArray(body.entry)) {
      console.warn('[Meta Webhook] Unexpected payload shape, ignoring.');
      return;
    }

    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        if (change.field === 'leadgen') {
          const { leadgen_id, form_id, ad_id, page_id } = change.value || {};
          // L-3: Log IDs only, not PII
          console.log(`[Meta Webhook] Received leadgen event: ID ${leadgen_id} on Page ${page_id}`);

          if (!leadgen_id) continue;

          try {
            const rawLead = await fetchMetaLeadDetails(leadgen_id);
            const parsed = parseMetaFieldData(rawLead.field_data);

            const formNotes = [
              `Form ID: ${form_id || 'N/A'}`,
              `Ad ID: ${ad_id || 'N/A'}`,
              parsed.notes,
            ]
              .filter(Boolean)
              .join(' · ');

            const created = await insertLeadIntoCrm({
              ...parsed,
              notes: formNotes,
              source: `Facebook Ad (${ad_id || 'Leadgen'})`,
              platform: 'Facebook',
            });

            // L-3: No PII (name) in logs
            console.log(`[Meta Webhook] Successfully ingested lead #${created.id}`);
          } catch (fetchErr) {
            console.error(`[Meta Webhook] Failed to fetch/save lead ${leadgen_id}:`, fetchErr.message);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Meta Webhook] Unexpected error handling payload:', err);
  }
}

/**
 * Send a mock test lead into CRM to simulate Facebook Ad submission
 * Note: This handler is only called from an admin-authenticated route (see server.js)
 */
export async function handleTestLead(req, res) {
  try {
    const testNames = ['Rahul Sharma', 'Priya Patel', 'Ananya Roy', 'Vikram Malhotra', 'Sneha Desai'];
    const randomName = testNames[Math.floor(Math.random() * testNames.length)];
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const mockEmail = `${randomName.toLowerCase().replace(/\s+/, '.')}${randomNum}@gmail.com`;
    const mockPhone = `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`;

    const lead = await insertLeadIntoCrm({
      name: req.body?.name || randomName,
      email: req.body?.email || mockEmail,
      phone: req.body?.phone || mockPhone,
      company: req.body?.company || 'Novera Client Corp',
      city: req.body?.city || 'Mumbai',
      source: 'Facebook Ad (Demo Test)',
      platform: 'Facebook',
      status: 'New leads',
      estimated_value: 50000,
      notes: 'Test lead generated via Meta Webhook simulator. Verified auto-ingestion into NOVERA CRM.',
    });

    return res.status(201).json({
      ok: true,
      message: 'Test Facebook lead created successfully in CRM!',
      data: lead,
    });
  } catch (err) {
    // M-7: Do not expose raw err.message to client — log server-side only
    console.error('[Meta Test Lead] Error:', err);
    return res.status(500).json({ error: 'Failed to create test lead.' });
  }
}

/**
 * Integration status endpoint — H-5: no verify token exposed; moved behind auth in server.js
 */
export function getMetaStatus(req, res) {
  res.json({
    configured: Boolean(META_PAGE_ACCESS_TOKEN),
    // H-5: Only confirm it's configured — never expose the actual token value
    verifyTokenConfigured: Boolean(META_VERIFY_TOKEN),
    appSecretConfigured: Boolean(META_APP_SECRET),
    webhookUrl: `${req.protocol}://${req.get('host')}/api/webhooks/facebook`,
  });
}
