import assert from 'node:assert/strict';
import test from 'node:test';
import { validate } from '../src/resources.js';

void test('validates lead records for bulk import', () => {
  const lead1 = validate('leads', {
    name: 'soshal',
    company: 'real estate',
    phone: '919871107544',
    city: 'Delhi',
    owner: 'Divyansh',
    service: 'Full Stack',
    status: 'Closed',
    source: 'Paid Ads',
    platform: 'Website',
  }, true);

  assert.equal(lead1.name, 'soshal');
  assert.equal(lead1.company, 'real estate');
  assert.equal(lead1.phone, '919871107544');
  assert.equal(lead1.city, 'Delhi');
  assert.equal(lead1.owner, 'Divyansh');
  assert.equal(lead1.service, 'Full Stack');
  assert.equal(lead1.status, 'Closed');
  assert.equal(lead1.source, 'Paid Ads');

  const lead2 = validate('leads', {
    name: 'Prakhar singh',
    company: 'cafe noida',
    phone: '919818897128',
    city: 'Delhi',
    owner: 'Shaurya',
    service: 'social media',
    status: 'Contacted',
    source: 'Paid Ads',
    platform: 'Website',
  }, true);

  assert.equal(lead2.name, 'Prakhar singh');
  assert.equal(lead2.company, 'cafe noida');
  assert.equal(lead2.phone, '919818897128');
  assert.equal(lead2.owner, 'Shaurya');
  assert.equal(lead2.service, 'social media');
});
