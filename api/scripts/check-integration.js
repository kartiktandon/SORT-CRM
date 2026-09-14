// Opt-in integration check against the running local frontend/API and configured DB.
// Creates uniquely named fixtures, then removes only those exact records.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { db } from '../src/db.js';
import { hashPassword } from '../src/security.js';

const origin = 'http://localhost:3000';
const suffix = randomBytes(8).toString('hex');
const email = `integration-${suffix}@example.invalid`;
const password = randomBytes(24).toString('hex');
const created = [];
let userId;
let documentKey;
let cookie = '';
async function request(path, method = 'GET', body, expected = 200) {
  const response = await fetch(`${origin}/api${path}`, {
    method,
    headers: {
      Origin: origin,
      Cookie: cookie,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: expected ${expected}, received ${response.status}`,
  );
  if (path === '/auth/login' && expected === 200)
    cookie = response.headers.get('set-cookie').split(';')[0];
  return response.status === 204 ? undefined : response.json();
}
async function create(resource, fields) {
  const result = await request(`/${resource}`, 'POST', fields, 201);
  created.push([resource, result.data.id]);
  return result.data;
}
try {
  await request('/bootstrap', 'GET', undefined, 401);
  const [result] = await db.execute(
    "INSERT INTO users(name,email,role,status,password_hash) VALUES(?,?,'admin','active',?)",
    [`Integration ${suffix}`, email, await hashPassword(password)],
  );
  userId = result.insertId;
  await request('/auth/login', 'POST', { email, password: 'incorrect' }, 401);
  await request('/auth/login', 'POST', { email, password });
  assert.equal((await request('/auth/me')).user.id, userId);
  const client = await create('clients', {
    name: `Integration ${suffix}`,
    monthly_value: 1200,
  });
  const project = await create('projects', {
    name: `Project ${suffix}`,
    client_id: client.id,
    progress: 35,
  });
  const task = await create('tasks', {
    title: `Task ${suffix}`,
    project_id: project.id,
    assignee_id: userId,
    due_date: '2026-10-01',
  });
  const lead = await create('leads', {
    name: `Lead ${suffix}`,
    status: 'New leads',
    platform: 'Website',
    follow_up: 'No follow-up',
  });
  await create('invoices', {
    invoice_number: `TEST-${suffix}`,
    client_id: client.id,
    amount: 100,
    status: 'Paid',
    issue_date: '2026-09-14',
  });
  await create('agreements', {
    title: `Agreement ${suffix}`,
    client_id: client.id,
  });
  await create('reports', {
    client_id: client.id,
    monthly_status: 'Submitted',
  });
  await create('users', {
    name: `Profile ${suffix}`,
    email: `profile-${suffix}@example.invalid`,
  });
  await request(`/tasks/${task.id}`, 'PATCH', { status: 'Completed' });
  await request(`/leads/${lead.id}`, 'PATCH', {
    status: 'Closed',
    notes: 'Persistence check',
  });
  await request('/projects', 'POST', { name: 'Missing client' }, 400);
  documentKey = `project-${project.id}`;
  await request(`/documents/${documentKey}`, 'PUT', {
    value: { notes: 'Saved' },
    version: 0,
  });
  await request(
    `/documents/${documentKey}`,
    'PUT',
    { value: {}, version: 0 },
    409,
  );
  const fresh = await request('/bootstrap');
  assert.equal(
    fresh.data.tasks.find((row) => row.id === task.id).status,
    'Completed',
  );
  assert.equal(
    fresh.data.leads.find((row) => row.id === lead.id).status,
    'Closed',
  );
  assert.equal(fresh.data.documents[documentKey].value.notes, 'Saved');
  assert.ok(fresh.data.users.every((row) => !('password_hash' in row)));
  await request('/auth/logout', 'POST', undefined, 204);
  await request('/bootstrap', 'GET', undefined, 401);
  console.log(
    'PASS: frontend proxy, login/logout, authenticated CRUD, validation, persistence, document conflict handling.',
  );
} finally {
  if (documentKey)
    await db.execute('DELETE FROM workspace_documents WHERE document_key=?', [
      documentKey,
    ]);
  for (const [resource, id] of created.reverse()) {
    assert.ok(
      [
        'clients',
        'projects',
        'tasks',
        'leads',
        'invoices',
        'agreements',
        'reports',
        'users',
      ].includes(resource),
    );
    await db.execute(`DELETE FROM \`${resource}\` WHERE id=?`, [id]);
  }
  if (userId) {
    await db.execute('DELETE FROM sessions WHERE user_id=?', [userId]);
    await db.execute('DELETE FROM users WHERE id=?', [userId]);
  }
  const [users] = await db.query(
    "SELECT COUNT(*) AS count FROM users WHERE role='admin' AND status='active' AND password_hash IS NOT NULL",
  );
  console.log('Active sign-in administrators:', users[0].count);
  await db.end();
  console.log('Temporary integration records removed.');
}
