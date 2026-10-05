import assert from 'node:assert/strict';
import test from 'node:test';
import { getTodayScheduleNotifications, istDateKey, isLostLead } from '../../app/schedule-notifications.ts';

void test('correctly identifies lost leads by status and stage case-insensitively', () => {
  assert.equal(isLostLead({ status: 'Lost' }), true);
  assert.equal(isLostLead({ status: 'lost' }), true);
  assert.equal(isLostLead({ stage: 'Lost' }), true);
  assert.equal(isLostLead({ stage: 'lost' }), true);
  assert.equal(isLostLead({ status: 'New leads' }), false);
  assert.equal(isLostLead({ status: 'Contacted' }), false);
  assert.equal(isLostLead({ status: 'Closed' }), false);
});

void test('excludes leads marked as Lost from today schedule notifications', () => {
  const fixedNow = new Date('2026-10-05T10:00:00.000Z');
  const todayKey = istDateKey(fixedNow);

  const sampleLeads = [
    {
      id: 1,
      name: 'Active Lead 1',
      company: 'Acme Corp',
      status: 'Contacted',
      follow_up_date: todayKey,
    },
    {
      id: 2,
      name: 'Lost Lead 1',
      company: 'Beta LLC',
      status: 'Lost',
      follow_up_date: todayKey,
    },
    {
      id: 3,
      name: 'Lost Lead 2 (by stage)',
      company: 'Gamma Inc',
      stage: 'Lost',
      follow_up_date: todayKey,
    },
    {
      id: 4,
      name: 'Active Lead 2',
      company: 'Delta Co',
      status: 'Interested',
      follow_up_date: todayKey,
    },
    {
      id: 5,
      name: 'Future Lead',
      company: 'Epsilon Ltd',
      status: 'Contacted',
      follow_up_date: '2026-10-10',
    },
  ];

  const notifications = getTodayScheduleNotifications(sampleLeads, fixedNow);

  assert.equal(notifications.length, 2);
  assert.deepEqual(notifications, [
    { id: 1, clientName: 'Active Lead 1', company: 'Acme Corp' },
    { id: 4, clientName: 'Active Lead 2', company: 'Delta Co' },
  ]);
});
