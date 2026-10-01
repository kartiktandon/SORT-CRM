import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_API_URL = 'https://www.googleapis.com';
const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events.owned',
];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_CALLBACK_URL;
  if (!clientId || !clientSecret || !redirectUri) {
    const error = new Error('Google Calendar is not configured on this server.');
    error.status = 503;
    error.expose = true;
    throw error;
  }
  return { clientId, clientSecret, redirectUri };
}

function encryptionKey() {
  const configured = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || '';
  const key = /^[a-f\d]{64}$/i.test(configured)
    ? Buffer.from(configured, 'hex')
    : Buffer.from(configured, 'base64');
  if (key.length !== 32) {
    const error = new Error('Google token encryption is not configured correctly.');
    error.status = 503;
    error.expose = true;
    throw error;
  }
  return key;
}

export function encryptToken(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptToken(value) {
  const [iv, tag, encrypted] = String(value).split('.');
  if (!iv || !tag || !encrypted) throw new Error('Stored Google credentials are invalid.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export const hashOAuthState = state => createHash('sha256').update(state).digest('hex');

export function validateGoogleCalendarConfig() {
  clientConfig();
  encryptionKey();
}

export function authorizationUrl(state) {
  const { clientId, redirectUri } = clientConfig();
  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: SCOPES.join(' '),
    state,
  }).toString();
  return url.toString();
}

async function responseJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      body?.error?.message || body?.error_description || 'Google Calendar request failed.',
    );
    error.status = response.status === 401 || response.status === 403 ? 409 : 502;
    error.googleStatus = response.status;
    throw error;
  }
  return body;
}

export async function exchangeAuthorizationCode(code) {
  const { clientId, clientSecret, redirectUri } = clientConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  return responseJson(response);
}

async function accessToken(refreshToken) {
  const { clientId, clientSecret } = clientConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  const tokens = await responseJson(response);
  return tokens.access_token;
}

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function googleRequest(refreshToken, path, options = {}) {
  const token = await accessToken(refreshToken);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${GOOGLE_API_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await wait(250 * (2 ** attempt));
      continue;
    }
    return responseJson(response);
  }
}

export async function getGoogleAccountEmail(refreshToken) {
  const profile = await googleRequest(refreshToken, '/oauth2/v2/userinfo');
  return profile.email || '';
}

function requiredString(value, name, maximum) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
    const error = new Error(`${name} is required and must be at most ${maximum} characters.`);
    error.status = 400;
    throw error;
  }
  return value.trim();
}

function validDate(value, name) {
  if (typeof value !== 'string') {
    const error = new Error(`${name} must be an ISO date and time.`);
    error.status = 400;
    throw error;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    const error = new Error(`${name} must be an ISO date and time.`);
    error.status = 400;
    throw error;
  }
  return date;
}

export function validateMeetingInput(input, { partial = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    const error = new Error('Meeting details are required.');
    error.status = 400;
    throw error;
  }
  const output = {};
  if (!partial || input.title !== undefined) output.title = requiredString(input.title, 'Title', 180);
  if (!partial || input.start_at !== undefined || input.end_at !== undefined) {
    const start = validDate(input.start_at, 'Start time');
    const end = validDate(input.end_at, 'End time');
    if (end <= start) {
      const error = new Error('End time must be after the start time.');
      error.status = 400;
      throw error;
    }
    output.start_at = start;
    output.end_at = end;
  }
  if (!partial || input.attendee_emails !== undefined) {
    if (!Array.isArray(input.attendee_emails) || !input.attendee_emails.length || input.attendee_emails.length > 50) {
      const error = new Error('Add between 1 and 50 attendee email addresses.');
      error.status = 400;
      throw error;
    }
    output.attendee_emails = [...new Set(input.attendee_emails.map(value => String(value).trim().toLowerCase()))];
    if (output.attendee_emails.some(value => !EMAIL.test(value) || value.length > 190)) {
      const error = new Error('Enter valid attendee email addresses.');
      error.status = 400;
      throw error;
    }
  }
  if (!partial || input.description !== undefined) {
    if (input.description != null && typeof input.description !== 'string') {
      const error = new Error('Description must be text.');
      error.status = 400;
      throw error;
    }
    output.description = String(input.description || '').trim().slice(0, 10000);
  }
  if (input.time_zone !== undefined || !partial) {
    const timeZone = input.time_zone || 'UTC';
    try {
      new Intl.DateTimeFormat('en', { timeZone }).format();
    } catch {
      const error = new Error('Select a valid time zone.');
      error.status = 400;
      throw error;
    }
    output.time_zone = timeZone;
  }
  return output;
}

const calendarPath = eventId => `/calendar/v3/calendars/primary/events${eventId ? `/${encodeURIComponent(eventId)}` : ''}`;

export async function createCalendarMeeting(refreshToken, meeting, googleEventId) {
  return googleRequest(
    refreshToken,
    `${calendarPath()}?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: 'POST',
      body: JSON.stringify({
        id: googleEventId,
        summary: meeting.title,
        description: meeting.description,
        start: { dateTime: meeting.start_at.toISOString(), timeZone: meeting.time_zone },
        end: { dateTime: meeting.end_at.toISOString(), timeZone: meeting.time_zone },
        attendees: meeting.attendee_emails.map(email => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: randomBytes(16).toString('hex'),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      }),
    },
  );
}

export async function updateCalendarMeeting(refreshToken, eventId, meeting) {
  const body = {};
  if (meeting.title) body.summary = meeting.title;
  if (meeting.description !== undefined) body.description = meeting.description;
  if (meeting.attendee_emails) body.attendees = meeting.attendee_emails.map(email => ({ email }));
  if (meeting.start_at) {
    body.start = { dateTime: meeting.start_at.toISOString(), timeZone: meeting.time_zone || 'UTC' };
    body.end = { dateTime: meeting.end_at.toISOString(), timeZone: meeting.time_zone || 'UTC' };
  }
  return googleRequest(refreshToken, `${calendarPath(eventId)}?sendUpdates=all`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function cancelCalendarMeeting(refreshToken, eventId) {
  return googleRequest(refreshToken, `${calendarPath(eventId)}?sendUpdates=all`, {
    method: 'DELETE',
  });
}

export async function revokeGoogleToken(refreshToken) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}

export function meetLinkFromEvent(event) {
  return event.hangoutLink || event.conferenceData?.entryPoints?.find(point => point.entryPointType === 'video')?.uri || '';
}