import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decryptToken,
  encryptToken,
  hashOAuthState,
  validateGoogleCalendarConfig,
  validateMeetingInput,
} from '../src/google-calendar.js';

process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

void test('encrypts Google refresh tokens with authenticated encryption', () => {
  const encrypted = encryptToken('refresh-token');
  assert.notEqual(encrypted, 'refresh-token');
  assert.equal(decryptToken(encrypted), 'refresh-token');
});

void test('hashes OAuth state without storing the bearer value', () => {
  assert.equal(hashOAuthState('state').length, 64);
  assert.notEqual(hashOAuthState('state'), 'state');
});

void test('reports an actionable error when Google OAuth is not configured', () => {
  const previous = process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;
  try {
    assert.throws(
      () => validateGoogleCalendarConfig(),
      error => error.status === 503
        && error.expose === true
        && error.message === 'Google Calendar is not configured on this server.',
    );
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = previous;
  }
});

void test('validates and normalizes a meeting request', () => {
  const meeting = validateMeetingInput({
    title: ' Discovery call ',
    start_at: '2026-10-15T10:00:00.000Z',
    end_at: '2026-10-15T10:30:00.000Z',
    attendee_emails: ['CUSTOMER@example.com', 'customer@example.com'],
    time_zone: 'Asia/Kolkata',
  });
  assert.equal(meeting.title, 'Discovery call');
  assert.deepEqual(meeting.attendee_emails, ['customer@example.com']);
});

void test('rejects a meeting ending before it starts', () => {
  assert.throws(() => validateMeetingInput({
    title: 'Invalid meeting',
    start_at: '2026-10-15T11:00:00.000Z',
    end_at: '2026-10-15T10:00:00.000Z',
    attendee_emails: ['customer@example.com'],
    time_zone: 'UTC',
  }), /End time must be after/);
});

void test('rejects malformed attendee email addresses', () => {
  assert.throws(() => validateMeetingInput({
    title: 'Invalid attendee',
    start_at: '2026-10-15T10:00:00.000Z',
    end_at: '2026-10-15T11:00:00.000Z',
    attendee_emails: ['not-an-email'],
    time_zone: 'UTC',
  }), /valid attendee/);
});