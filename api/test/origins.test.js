import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAllowedOrigins,
  isOriginAllowed,
  normalizeOrigin,
} from '../src/origins.js';

void test('allows the production CRM origin', () => {
  const origins = createAllowedOrigins();
  assert.equal(isOriginAllowed('https://crm.buildwithnovera.com', origins), true);
});

void test('normalizes configured origins and trailing slashes', () => {
  const origins = createAllowedOrigins('https://preview.example.com/');
  assert.equal(
    isOriginAllowed('https://preview.example.com', origins),
    true,
  );
  assert.equal(
    normalizeOrigin('https://CRM.BUILDWITHNOVERA.COM/'),
    'https://crm.buildwithnovera.com',
  );
});

void test('allows requests without an Origin header', () => {
  assert.equal(isOriginAllowed(undefined, createAllowedOrigins()), true);
});

void test('rejects unconfigured and malformed origins', () => {
  const origins = createAllowedOrigins();
  assert.equal(isOriginAllowed('https://attacker.example', origins), false);
  assert.equal(isOriginAllowed('not an origin', origins), false);
});