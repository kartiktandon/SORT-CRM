import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseLegacyBudgetFromNotes,
  parseLegacyServiceFromNotes,
  parseMetaFieldData,
} from '../src/meta.js';

test('maps the Meta estimated project budget field to the CRM budget', () => {
  const lead = parseMetaFieldData([
    { name: 'full_name', values: ['Test Lead'] },
    {
      name: 'what_is_your_estimated_project_budget',
      values: ['above_₹5,00,000'],
    },
  ]);

  assert.equal(lead.budget, 'Above ₹5,00,000');
  assert.equal(lead.notes, '');
});

test('keeps unrelated custom Meta fields in notes', () => {
  const lead = parseMetaFieldData([
    { name: 'email', values: ['lead@example.com'] },
    { name: 'preferred_service', values: ['Web development'] },
  ]);

  assert.equal(lead.name, 'lead');
  assert.equal(lead.budget, '');
  assert.equal(lead.notes, 'preferred_service: Web development');
});

test('maps what_do_you_want_to_build to the interested service', () => {
  const lead = parseMetaFieldData([
    { name: 'full_name', values: ['Test Lead'] },
    { name: 'what_do_you_want_to_build', values: ['website_development'] },
  ]);

  assert.equal(lead.service, 'Website development');
  assert.equal(lead.notes, '');
});

test('recovers the estimated budget from an existing lead note', () => {
  const notes =
    'Form ID: 123 · what_do_you_want_to_build?: android_app | what_is_your_estimated_project_budget?: above_₹5,00,000';

  assert.equal(parseLegacyBudgetFromNotes(notes), 'Above ₹5,00,000');
  assert.equal(parseLegacyBudgetFromNotes('Form ID: 123 · no budget'), '');
});

test('recovers interested service from an existing lead note', () => {
  const notes =
    'Form ID: 123 · what_do_you_want_to_build?: android_app | what_is_your_estimated_project_budget?: above_₹5,00,000';

  assert.equal(parseLegacyServiceFromNotes(notes), 'Android app');
  assert.equal(parseLegacyServiceFromNotes('Form ID: 123 · no service'), '');
});