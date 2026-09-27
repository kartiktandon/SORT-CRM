import { db } from './db.js';
import { createHmac, timingSafeEqual } from 'node:crypto';

// Use env var or fallback so server never crashes on startup
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'novera_lead_secret_2026';
const META_PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN || '';
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
  const rawToken = process.env.META_PAGE_ACCESS_TOKEN || META_PAGE_ACCESS_TOKEN || '';
  const cleanToken = rawToken.replace(/^["']|["']$/g, '').trim();
  if (!cleanToken) {
    throw new Error('META_PAGE_ACCESS_TOKEN is not configured in environment variables');
  }

  const cleanId = String(leadgenId).trim();
  // Meta Graph API standard: pass access_token as query param with requested fields
  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(cleanId)}?fields=id,created_time,field_data&access_token=${encodeURIComponent(cleanToken)}`;
  
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'NoveraCRM/1.0',
    },
    signal: AbortSignal.timeout(15000),
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
    budget: '',
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
    } else if (key === 'budget' || key.includes('estimated_project_budget')) {
      const readableBudget = String(value).replaceAll('_', ' ').trim();
      lead.budget = readableBudget
        ? readableBudget.charAt(0).toUpperCase() + readableBudget.slice(1)
        : '';
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
 * Recover a Meta budget answer that older webhook versions stored in notes.
 */
export function parseLegacyBudgetFromNotes(notes = '') {
  const match = String(notes).match(
    /(?:^|[|·])\s*what_is_your_estimated_project_budget\??:\s*([^|·]+)/i,
  );
  if (!match) return '';

  const readableBudget = match[1].replaceAll('_', ' ').trim();
  return readableBudget
    ? readableBudget.charAt(0).toUpperCase() + readableBudget.slice(1)
    : '';
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
  budget = '',
  source = 'Facebook Ad',
  platform = 'Facebook',
  status = 'New leads',
  estimated_value = 0,
  notes = '',
}) {
  const [result] = await db.query(
    `INSERT INTO leads (name, email, phone, company, city, budget, source, platform, status, estimated_value, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name.slice(0, 120),
      (email || '').slice(0, 190),
      (phone || '').slice(0, 40),
      (company || '').slice(0, 160),
      (city || '').slice(0, 100),
      (budget || '').slice(0, 190),
      source.slice(0, 80),
      platform,
      status,
      Number(estimated_value) || 0,
      notes,
    ],
  );

  const [rows] = await db.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
  if (notes.trim()) {
    await db.execute(
      'INSERT INTO lead_notes (lead_id, user_name, note) VALUES (?, ?, ?)',
      [result.insertId, 'Meta Lead Ads', notes],
    );
  }
  return rows[0];
}

/**
 * Verify Meta's X-Hub-Signature-256 HMAC signature on the raw request body.
 * If META_APP_SECRET is configured, enforce strict HMAC validation.
 * If not configured yet, allow with a warning so the user can configure it without breakage.
 */
function verifyHmacSignature(rawBody, signatureHeader) {
  const secret = (process.env.META_APP_SECRET || META_APP_SECRET || '').trim();
  if (!secret) {
    console.warn('[Meta Webhook] META_APP_SECRET not configured. Please add it to environment variables to enable signature verification.');
    return true;
  }
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  try {
    const expected = 'sha256=' + createHmac('sha256', secret)
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
  const rawBody = req.rawBody || JSON.stringify(req.body);
  const signature = req.headers['x-hub-signature-256'];
  if (!verifyHmacSignature(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody), signature)) {
    console.warn('[Meta Webhook] Invalid or missing X-Hub-Signature-256 — rejecting request.');
    return res.status(403).send('Invalid signature');
  }

  try {
    const body = req.body;

    if (typeof body !== 'object' || !body || body.object !== 'page' || !Array.isArray(body.entry)) {
      return;
    }

    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        if (change.field === 'leadgen') {
          const { leadgen_id, form_id, ad_id, page_id } = change.value || {};
          console.log(`[Meta Webhook] Received leadgen event: ID ${leadgen_id} on Page ${page_id}`);

          if (!leadgen_id) continue;

          try {
            let rawLead;
            const isMetaDummyTest = String(leadgen_id) === '444444444444' || /^4+$/.test(String(leadgen_id));

            if (isMetaDummyTest) {
              console.log(`[Meta Webhook] Meta Dashboard dummy test ping (ID ${leadgen_id}). Creating verified test lead in CRM.`);
              rawLead = {
                field_data: [
                  { name: 'full_name', values: ['Meta Dashboard Test Lead'] },
                  { name: 'email', values: ['test-webhook@meta.com'] },
                  { name: 'phone_number', values: ['+1-555-0199'] },
                  { name: 'city', values: ['San Francisco'] },
                  { name: 'company_name', values: ['Meta Verified Partner'] },
                ],
              };
            } else {
              try {
                rawLead = await fetchMetaLeadDetails(leadgen_id);
              } catch (fetchErr) {
                const causeInfo = fetchErr.cause ? ` (${fetchErr.cause.code || fetchErr.cause.message || fetchErr.cause})` : '';
                const fullErr = `${fetchErr.message}${causeInfo}`;
                console.error(`[Meta Webhook] Could not fetch contact details for lead ${leadgen_id}:`, fullErr);
                rawLead = {
                  field_data: [
                    { name: 'full_name', values: [`Facebook Lead #${leadgen_id}`] },
                    { name: 'notes', values: [`Contact details retrieval note: ${fullErr}`] },
                  ],
                };
              }
            }

            const parsed = parseMetaFieldData(rawLead.field_data);

            const formNotes = [
              `Form ID: ${form_id || 'N/A'}`,
              `Ad ID: ${ad_id || (isMetaDummyTest ? 'Dashboard Test' : 'Leadgen')}`,
              parsed.notes,
            ]
              .filter(Boolean)
              .join(' · ');

            const created = await insertLeadIntoCrm({
              ...parsed,
              notes: formNotes,
              source: `Facebook Ad (${ad_id || (isMetaDummyTest ? 'Dashboard Test' : 'Leadgen')})`,
              platform: 'Facebook',
            });

            console.log(`[Meta Webhook] Successfully ingested lead #${created.id}`);
          } catch (fetchErr) {
            console.error(`[Meta Webhook] Failed to save lead ${leadgen_id}:`, fetchErr.message);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Meta Webhook] Unexpected error handling payload:', err);
  } finally {
    // Acknowledge Meta only AFTER all database insertions have finished
    res.status(200).send('EVENT_RECEIVED');
  }
}

/**
 * Send a mock test lead into CRM to simulate Facebook Ad submission
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
    console.error('[Meta Test Lead] Error:', err);
    return res.status(500).json({ error: 'Failed to create test lead.' });
  }
}

/**
 * Integration status endpoint
 */
export function getMetaStatus(req, res) {
  res.json({
    configured: Boolean(process.env.META_PAGE_ACCESS_TOKEN || META_PAGE_ACCESS_TOKEN),
    verifyTokenConfigured: Boolean(process.env.META_VERIFY_TOKEN || META_VERIFY_TOKEN),
    appSecretConfigured: Boolean(process.env.META_APP_SECRET || META_APP_SECRET),
    webhookUrl: `${req.protocol}://${req.get('host')}/api/webhooks/facebook`,
  });
}
