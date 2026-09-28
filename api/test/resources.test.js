import assert from 'node:assert/strict';
import test from 'node:test';
import { validate } from '../src/resources.js';

void test('requires a password when creating a team member', () => {
  assert.throws(
    () => validate('users', { name: 'Team Member', email: 'member@example.com' }, true),
    /password is required/,
  );
});

void test('accepts a strong team-member password without trimming it', () => {
  const password = ' separate login password ';
  const result = validate(
    'users',
    { name: 'Team Member', email: 'member@example.com', password },
    true,
  );

  assert.equal(result.password, password);
});

void test('rejects a team-member password shorter than 12 characters', () => {
  assert.throws(
    () => validate(
      'users',
      { name: 'Team Member', email: 'member@example.com', password: 'too-short' },
      true,
    ),
    /Invalid password/,
  );
});

void test('allows editing a team member without changing the password', () => {
  assert.deepEqual(validate('users', { job_title: 'Developer' }), {
    job_title: 'Developer',
  });
});