'use client';

import { useId, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  LayoutGrid,
  List,
  Plus,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  useCrm,
  useRecords,
  text,
  money,
  dateLabel,
  type RecordData,
} from './crm-data';
import './workspace.css';
import LeadsExplorer from './leads';

type Row = ReactNode[];
const today = () => new Date().toLocaleDateString('en-CA');
function Action({
  children,
  onClick,
  secondary = false,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <Button
      type={type}
      className={`ws-button ${secondary ? 'ws-secondary' : ''}`}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
function Tabs({
  items,
  active,
  onChange,
}: {
  items: string[];
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="ws-tabs" aria-label="View options">
      {items.map((item) => (
        <Button
          key={item}
          className={active === item ? 'selected' : ''}
          aria-pressed={active === item}
          onClick={() => onChange(item)}
        >
          {item === 'Kanban' && <LayoutGrid size={13} />}{' '}
          {item === 'List' && <List size={13} />} {item}
        </Button>
      ))}
    </div>
  );
}
function Badge({ value }: { value: string }) {
  const tone = /Active|Paid|Submitted|On Track|Completed|Won|Closed/.test(value)
    ? 'green'
    : /Pending|Onboarding|Attention|Warm/.test(value)
      ? 'amber'
      : /Overdue|Delayed|Not Started|Hot|Lost/.test(value)
        ? 'red'
        : 'blue';
  return <span className={`ws-badge ${tone}`}>{value}</span>;
}
function DataTable({
  columns,
  rows,
  empty = 'No matching results.',
}: {
  columns: string[];
  rows: Row[];
  empty?: string;
}) {
  return (
    <div className="ws-table">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col, i) => (
              <TableHead key={`${col}-${i}`}>{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {row.map((cell, j) => (
                <TableCell key={j}>{cell}</TableCell>
              ))}
            </TableRow>
          ))}
          {!rows.length && (
            <TableRow>
              <TableCell colSpan={columns.length}>
                <div className="ws-empty">{empty}</div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
function Heading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="workspace-toolbar">
      <div>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      <div className="ws-actions">{children}</div>
    </div>
  );
}
function SearchBox({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const id = useId();
  return (
    <label className="table-search" htmlFor={id}>
      <Search size={15} />
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
      />
    </label>
  );
}
function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="ws-select"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  );
}
function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <article className="ws-panel">
      <div className="ws-panel-heading">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </article>
  );
}
function downloadText(name: string, content: string, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function RecordForm({
  title,
  open,
  onClose,
  onSave,
  fields,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  onSave: (data: Record<string, string>) => Promise<unknown>;
  fields: string[];
}) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent className="ws-dialog">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          Enter the details for this record.
        </DialogDescription>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (saving) return;
            const data = Object.fromEntries(
              new FormData(event.currentTarget),
            ) as Record<string, string>;
            setSaving(true);
            setError('');
            try {
              await onSave(data);
              onClose();
            } catch (error) {
              setError(error instanceof Error ? error.message : 'Save failed.');
            } finally {
              setSaving(false);
            }
          }}
        >
          {error && <p role="alert">{error}</p>}
          {fields.map((field, i) => (
            <label key={field}>
              {field}
              <Input name={field} required={i === 0} placeholder={field} />
            </label>
          ))}
          <div className="ws-actions">
            <Action secondary onClick={onClose}>
              Cancel
            </Action>
            <Button type="submit" disabled={saving} className="ws-button">
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Field = {
  key: string;
  label: string;
  kind?: 'number' | 'date' | 'email' | 'url' | 'textarea';
  options?: string[];
  resource?: string;
  required?: boolean;
};
const field = (
  key: string,
  label: string,
  extra: Omit<Field, 'key' | 'label'> = {},
): Field => ({ key, label, ...extra });
const clientField = field('client_id', 'Client', {
  resource: 'clients',
  required: true,
});
const statusField = (options: string[]) =>
  field('status', 'Status', { options });
const definitions: Record<
  string,
  { title: string; singular: string; fields: Field[] }
> = {
  clients: {
    title: 'Clients',
    singular: 'Client',
    fields: [
      field('name', 'Client Name', { required: true }),
      field('industry', 'Industry'),
      field('email', 'Email', { kind: 'email' }),
      field('phone', 'Phone'),
      field('type', 'Type', { options: ['Retainer', 'Project'] }),
      field('monthly_value', 'Monthly Value', { kind: 'number' }),
      statusField(['Onboarding', 'Active', 'Inactive']),
    ],
  },
  projects: {
    title: 'Projects',
    singular: 'Project',
    fields: [
      field('name', 'Project Name', { required: true }),
      clientField,
      field('description', 'Description', { kind: 'textarea' }),
      statusField(['Not started', 'In progress', 'On hold', 'Completed']),
      field('progress', 'Progress (%)', { kind: 'number' }),
      field('start_date', 'Start Date', { kind: 'date' }),
      field('due_date', 'Due Date', { kind: 'date' }),
      field('monthly_value', 'Monthly Value', { kind: 'number' }),
    ],
  },
  tasks: {
    title: 'Tasks',
    singular: 'Task',
    fields: [
      field('title', 'Task', { required: true }),
      field('project_id', 'Project', { resource: 'projects' }),
      field('assignee_id', 'Assignee', { resource: 'users' }),
      field('description', 'Description', { kind: 'textarea' }),
      statusField(['Not started', 'Pending', 'In progress', 'Completed']),
      field('priority', 'Priority', { options: ['low', 'medium', 'high'] }),
      field('due_date', 'Due Date', { kind: 'date' }),
    ],
  },
  invoices: {
    title: 'Invoices',
    singular: 'Invoice',
    fields: [
      field('invoice_number', 'Invoice Number', { required: true }),
      clientField,
      field('amount', 'Amount', { kind: 'number', required: true }),
      statusField(['Draft', 'Pending', 'Paid', 'Overdue']),
      field('issue_date', 'Issue Date', { kind: 'date' }),
      field('due_date', 'Due Date', { kind: 'date' }),
    ],
  },
  agreements: {
    title: 'Agreements',
    singular: 'Agreement',
    fields: [
      field('title', 'Title', { required: true }),
      clientField,
      field('type', 'Type'),
      statusField(['Draft', 'Sent', 'Active', 'Expired']),
      field('start_date', 'Start Date', { kind: 'date' }),
      field('end_date', 'End Date', { kind: 'date' }),
      field('document_url', 'Document URL', { kind: 'url' }),
    ],
  },
  users: {
    title: 'Team',
    singular: 'Team Member',
    fields: [
      field('name', 'Name', { required: true }),
      field('email', 'Email', { kind: 'email', required: true }),
      field('job_title', 'Job Title'),
      field('phone', 'Phone'),
      statusField(['active', 'away', 'inactive']),
    ],
  },
  reports: {
    title: 'Reports',
    singular: 'Report',
    fields: [
      clientField,
      field('weekly_reports', 'Weekly Reports'),
      field('monthly_status', 'Monthly Status', {
        options: ['Pending', 'Submitted'],
      }),
      field('health', 'Health', { options: ['On Track', 'Delayed'] }),
      field('submitted_at', 'Submitted At', { kind: 'date' }),
    ],
  },
};

function RecordEditor({
  resource,
  record,
  onClose,
}: {
  resource: string;
  record: Partial<RecordData>;
  onClose: () => void;
}) {
  const { data, save, busy } = useCrm();
  const definition = definitions[resource];
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      definition.fields.map((f) => [
        f.key,
        String(
          record[f.key] ?? f.options?.[0] ?? (f.kind === 'number' ? '0' : ''),
        ),
      ]),
    ),
  );
  const [error, setError] = useState('');
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="ws-dialog"
        style={{ maxHeight: '85vh', overflowY: 'auto' }}
      >
        <DialogTitle>
          {record.id ? 'Edit' : 'Add'} {definition.singular}
        </DialogTitle>
        <DialogDescription>
          Changes are saved to your workspace database.
        </DialogDescription>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            setError('');
            try {
              const payload: Partial<RecordData> = record.id
                ? { id: record.id }
                : {};
              for (const f of definition.fields) {
                const value = values[f.key];
                payload[f.key] = f.resource
                  ? value
                    ? Number(value)
                    : null
                  : f.kind === 'number'
                    ? Number(value)
                    : f.kind === 'date'
                      ? value || null
                      : value;
              }
              await save(resource, payload);
              onClose();
            } catch (error) {
              setError(error instanceof Error ? error.message : 'Save failed.');
            }
          }}
        >
          {definition.fields.map((f) => (
            <label
              key={f.key}
              style={{ display: 'grid', gap: 6, marginBottom: 12 }}
            >
              {f.label}
              {f.required ? ' *' : ''}
              {f.options || f.resource ? (
                <select
                  className="ws-select"
                  required={f.required}
                  value={values[f.key]}
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: e.target.value })
                  }
                >
                  {f.resource && (
                    <option value="">Select {f.label.toLowerCase()}</option>
                  )}
                  {f.options?.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                  {f.resource &&
                    ((data[f.resource] || []) as RecordData[]).map((row) => (
                      <option key={row.id} value={row.id}>
                        {text(row, 'name')}
                      </option>
                    ))}
                </select>
              ) : f.kind === 'textarea' ? (
                <textarea
                  className="ws-notes"
                  value={values[f.key]}
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: e.target.value })
                  }
                />
              ) : (
                <Input
                  type={f.kind || 'text'}
                  min={f.kind === 'number' ? 0 : undefined}
                  max={f.key === 'progress' ? 100 : undefined}
                  step={
                    f.kind === 'number'
                      ? f.key === 'progress'
                        ? 1
                        : '0.01'
                      : undefined
                  }
                  required={f.required}
                  value={values[f.key]}
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: e.target.value })
                  }
                />
              )}
            </label>
          ))}
          {error && <p role="alert">{error}</p>}
          <div className="ws-actions">
            <Button type="button" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button className="ws-button" disabled={busy} type="submit">
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResourceView({
  resource,
  filter,
  onOpen,
}: {
  resource: string;
  filter?: (row: RecordData) => boolean;
  onOpen?: (row: RecordData) => void;
}) {
  const { data, user } = useCrm();
  const all = useRecords(resource);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [draft, setDraft] = useState<Partial<RecordData> | null>(null);
  const definition = definitions[resource];
  const rows = all.filter(
    (row) =>
      (!filter || filter(row)) &&
      Object.values(row)
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === 'All' || row.status === status),
  );
  const canEdit = resource !== 'users' || user.role === 'admin';
  const columns = definition.fields.filter(
    (f) => f.kind !== 'textarea' && f.key !== 'document_url',
  );
  const display = (row: RecordData, f: Field): ReactNode => {
    if (f.resource) {
      const related = ((data[f.resource] || []) as RecordData[]).find(
        (item) => item.id === Number(row[f.key]),
      );
      return related ? text(related, 'name') : '—';
    }
    if (f.kind === 'date') return dateLabel(row[f.key]);
    if (['amount', 'monthly_value'].includes(f.key)) return money(row[f.key]);
    if (f.key.includes('status') || f.key === 'health')
      return <Badge value={text(row, f.key)} />;
    return text(row, f.key) || '—';
  };
  return (
    <>
      <Heading title={definition.title}>
        <SearchBox
          label={'Search ' + definition.title.toLowerCase()}
          value={query}
          onChange={setQuery}
        />
        {definition.fields.find((f) => f.key === 'status')?.options && (
          <Select
            label="Status filter"
            value={status}
            options={[
              'All',
              ...definition.fields.find((f) => f.key === 'status')!.options!,
            ]}
            onChange={setStatus}
          />
        )}
        {canEdit && (
          <Action onClick={() => setDraft({})}>
            <Plus size={14} />
            Add {definition.singular}
          </Action>
        )}
      </Heading>
      <DataTable
        columns={[...columns.map((f) => f.label), 'Action']}
        rows={rows.map((row) => [
          ...columns.map((f) => display(row, f)),
          <span key={row.id} className="ws-actions">
            {onOpen && (
              <button className="ws-link" onClick={() => onOpen(row)}>
                View
              </button>
            )}
            {canEdit && (
              <button className="ws-link" onClick={() => setDraft(row)}>
                Edit
              </button>
            )}
          </span>,
        ])}
        empty={
          all.length
            ? 'No matching records.'
            : 'No ' +
              definition.title.toLowerCase() +
              ' yet. Add a record to get started.'
        }
      />
      {resource === 'users' && (
        <p className="ws-hint">
          Team profiles do not automatically receive sign-in credentials.
        </p>
      )}
      {draft && (
        <RecordEditor
          resource={resource}
          record={draft}
          onClose={() => setDraft(null)}
        />
      )}
    </>
  );
}

export default function WorkspaceContent({
  active,
  navigate,
}: {
  active: string;
  navigate: (value: string) => void;
}) {
  return (
    <div className="ws-content">
      {active === 'Dashboard' && <Dashboard navigate={navigate} />}
      {active === 'Leads' && <LeadsExplorer />}
      {active === 'Clients' && <ClientsView />}
      {active === 'Projects' && <ProjectsView />}
      {active === 'Finance' && <FinanceView />}
      {active === 'Agreements' && <AgreementsView />}
      {active === 'Team' && <TeamView />}
      {active === 'Reports' && <ResourceView resource="reports" />}
      {(active === 'Tasks' || active === 'Calendar') && (
        <TasksView key={active} calendar={active === 'Calendar'} />
      )}
      {active === 'Settings' && <SettingsView />}
    </div>
  );
}

function Dashboard({ navigate }: { navigate: (value: string) => void }) {
  const { user } = useCrm();
  const leads = useRecords('leads'),
    clients = useRecords('clients'),
    projects = useRecords('projects'),
    users = useRecords('users'),
    invoices = useRecords('invoices'),
    tasks = useRecords('tasks');
  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);
  const paid = invoices.filter((row) => row.status === 'Paid');
  const total = (rows: RecordData[]) =>
    rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const stats = [
    ['Total Leads', leads.length],
    ['Active Clients', clients.filter((row) => row.status === 'Active').length],
    [
      'Ongoing Projects',
      projects.filter((row) => row.status !== 'Completed').length,
    ],
    ['Team Members', users.length],
    [
      'Paid Invoices This Month',
      money(
        total(
          paid.filter((row) =>
            String(row.issue_date || '').startsWith(monthKey),
          ),
        ),
      ),
    ],
  ];
  const revenue = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const key =
      date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
    return {
      month: date.toLocaleDateString('en', { month: 'short', year: '2-digit' }),
      amount: total(
        paid.filter((row) => String(row.issue_date || '').startsWith(key)),
      ),
    };
  });
  const due = tasks
    .filter((row) => {
      const date = String(row.due_date || '').slice(0, 10);
      return (
        date >= today() &&
        date <=
          new Date(now.getTime() + 6 * 86400000).toLocaleDateString('en-CA') &&
        row.status !== 'Completed'
      );
    })
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  return (
    <>
      <section className="welcome ws-welcome">
        <div>
          <h2>
            Hello, {user.name} <span>👋</span>
          </h2>
          <p>Here’s what’s happening in your workspace.</p>
        </div>
      </section>
      <div className="ws-stats five">
        {stats.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <div>
              <strong>{value}</strong>
            </div>
          </article>
        ))}
      </div>
      <div className="ws-dashboard-grid">
        <Panel title="Paid Invoices by Issue Month">
          <ChartContainer
            className="ws-revenue-chart"
            config={{ amount: { label: 'Amount (INR)', color: '#5841ed' } }}
          >
            <AreaChart data={revenue}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => money(value)} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                dataKey="amount"
                stroke="#5841ed"
                fill="#e6e0ff"
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        </Panel>
        <Panel title="Project Status">
          <DataTable
            columns={['Status', 'Projects']}
            rows={['Not started', 'In progress', 'On hold', 'Completed'].map(
              (status) => [
                status,
                projects.filter((row) => row.status === status).length,
              ],
            )}
          />
        </Panel>
        <Panel title="Tasks Due in the Next 7 Days">
          <div className="ws-due-list">
            {due.map((task) => (
              <button key={task.id} onClick={() => navigate('Tasks')}>
                <Clock3 size={14} />
                <span>{text(task, 'title')}</span>
                <time>{dateLabel(task.due_date)}</time>
              </button>
            ))}
            {!due.length && <p className="ws-empty">No tasks due.</p>}
          </div>
        </Panel>
      </div>
    </>
  );
}

function ClientsView() {
  const [client, setClient] = useState<RecordData | null>(null);
  if (client)
    return (
      <>
        <button className="ws-link" onClick={() => setClient(null)}>
          <ArrowLeft size={14} />
          Back to Clients
        </button>
        <Heading title={text(client, 'name')} />
        <ProjectsView clientId={client.id} />
      </>
    );
  return <ResourceView resource="clients" onOpen={setClient} />;
}
function ProjectsView({ clientId }: { clientId?: number }) {
  const [project, setProject] = useState<RecordData | null>(null);
  if (project)
    return <ProjectDetail id={project.id} onBack={() => setProject(null)} />;
  return (
    <ResourceView
      resource="projects"
      filter={
        clientId ? (row) => Number(row.client_id) === clientId : undefined
      }
      onOpen={setProject}
    />
  );
}
function ProjectDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const project = useRecords('projects').find((row) => row.id === id)!;
  const { save, busy } = useCrm();
  const [tab, setTab] = useState('Overview');
  const [notes, setNotes] = useState(text(project, 'description'));
  const [saved, setSaved] = useState(false);
  const assignedIds = new Set(
    useRecords('tasks')
      .filter((row) => Number(row.project_id) === id)
      .map((row) => Number(row.assignee_id)),
  );
  const members = useRecords('users').filter((row) => assignedIds.has(row.id));
  return (
    <>
      <button className="ws-link" onClick={onBack}>
        <ArrowLeft size={14} />
        Back to Projects
      </button>
      <Heading title={text(project, 'name')} />
      <Tabs
        items={[
          'Overview',
          'Tasks',
          'Reports',
          'Team',
          'Files',
          'Billing',
          'Notes',
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'Overview' && (
        <Panel title="Project Progress">
          <progress value={Number(project.progress)} max={100} />
          <p>
            {Number(project.progress)}% · {text(project, 'status')}
          </p>
          <p>
            {dateLabel(project.start_date)} – {dateLabel(project.due_date)}
          </p>
          <p>{money(project.monthly_value)} / month</p>
        </Panel>
      )}
      {tab === 'Tasks' && (
        <ResourceView
          resource="tasks"
          filter={(row) => Number(row.project_id) === id}
        />
      )}
      {tab === 'Reports' && (
        <ResourceView
          resource="reports"
          filter={(row) => Number(row.client_id) === Number(project.client_id)}
        />
      )}
      {tab === 'Billing' && (
        <ResourceView
          resource="invoices"
          filter={(row) => Number(row.client_id) === Number(project.client_id)}
        />
      )}
      {tab === 'Team' && (
        <Panel title="Team Assigned to Project Tasks">
          <DataTable
            columns={['Name', 'Role', 'Email', 'Phone']}
            rows={members.map((row) => [
              text(row, 'name'),
              text(row, 'job_title'),
              text(row, 'email'),
              text(row, 'phone'),
            ])}
          />
          <p className="ws-hint">
            Assign team members through the project’s tasks.
          </p>
        </Panel>
      )}
      {tab === 'Files' && <AssetsView projectId={id} />}
      {tab === 'Notes' && (
        <Panel title="Project Notes">
          <textarea
            className="ws-notes"
            aria-label="Project notes"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setSaved(false);
            }}
          />
          <Button
            disabled={busy}
            className="ws-button"
            onClick={async () => {
              try {
                await save('projects', { id, description: notes });
                setSaved(true);
              } catch {
                setSaved(false);
              }
            }}
          >
            {saved ? 'Saved' : 'Save Notes'}
          </Button>
        </Panel>
      )}
    </>
  );
}
function FinanceView() {
  const invoices = useRecords('invoices');
  const [tab, setTab] = useState('Overview');
  const [month, setMonth] = useState('All months');
  const months = Array.from(
    new Set(
      invoices
        .map((row) => String(row.issue_date || '').slice(0, 7))
        .filter(Boolean),
    ),
  )
    .sort()
    .reverse();
  const rows = invoices.filter(
    (row) =>
      month === 'All months' || String(row.issue_date || '').startsWith(month),
  );
  return (
    <>
      <Heading title="Finance Center">
        <Select
          label="Finance month"
          value={month}
          options={['All months', ...months]}
          onChange={setMonth}
        />
      </Heading>
      <Tabs
        items={[
          'Overview',
          'Invoices',
          'Payments',
          'Agreements',
          'Expenses',
          'Profit & Loss',
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'Overview' && (
        <div className="ws-stats">
          {['Total Invoiced', 'Paid', 'Pending', 'Overdue'].map((status) => (
            <article key={status}>
              <span>{status}</span>
              <strong>
                {money(
                  rows
                    .filter(
                      (row) =>
                        status === 'Total Invoiced' || row.status === status,
                    )
                    .reduce((sum, row) => sum + Number(row.amount), 0),
                )}
              </strong>
            </article>
          ))}
        </div>
      )}
      {(tab === 'Invoices' || tab === 'Payments') && (
        <ResourceView
          resource="invoices"
          filter={(row) =>
            (month === 'All months' ||
              String(row.issue_date || '').startsWith(month)) &&
            (tab !== 'Payments' || row.status === 'Paid')
          }
        />
      )}
      {tab === 'Agreements' && <ResourceView resource="agreements" />}
      {(tab === 'Expenses' || tab === 'Profit & Loss') && (
        <p className="ws-empty">
          Expense tracking is not connected yet. No expense or profit figures
          are available.
        </p>
      )}
    </>
  );
}
function AgreementsView() {
  const [tab, setTab] = useState('Records');
  return (
    <>
      <Tabs items={['Records', 'Generator']} active={tab} onChange={setTab} />
      {tab === 'Records' ? (
        <ResourceView resource="agreements" />
      ) : (
        <AgreementGenerator />
      )}
    </>
  );
}
function AgreementGenerator() {
  const [step, setStep] = useState(0);
  const { data, saveDocument, busy } = useCrm();
  const [error, setError] = useState('');
  const agencyName =
    ((data.documents.settings?.value || {}) as { name?: string }).name ||
    'Your workspace';
  const [form, setForm] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(
      [
        'Client Name',
        'Company Name',
        'Email',
        'Phone',
        'Address',
        'GST Number (Optional)',
        'Project Name',
        'Services',
        'Start Date',
        'End Date',
        'Monthly Fee',
        'Payment Terms',
        'Notice Period',
        'Tax Rate',
      ].map((key) => [key, '']),
    ),
    ...((data.documents['agreement-draft']?.value || {}) as Record<
      string,
      string
    >),
  }));

  const steps = [
    'Client Details',
    'Project & Services',
    'Commercials',
    'Review & Generate',
  ];
  const fields = [
    [
      'Client Name',
      'Company Name',
      'Email',
      'Phone',
      'Address',
      'GST Number (Optional)',
    ],
    ['Project Name', 'Services', 'Start Date', 'End Date'],
    ['Monthly Fee', 'Payment Terms', 'Notice Period', 'Tax Rate'],
  ];
  const agreement = `MASTER SERVICES AGREEMENT\n\n${agencyName} × ${form['Client Name']}\n\nClient: ${form['Company Name']}\nEmail: ${form.Email}\nPhone: ${form.Phone}\nAddress: ${form.Address}\n\nProject: ${form['Project Name']}\nServices: ${form.Services}\nTerm: ${form['Start Date']} – ${form['End Date']}\nMonthly Fee: ${form['Monthly Fee']}\nTax Rate: ${form['Tax Rate']}\nPayment Terms: ${form['Payment Terms']}\nNotice Period: ${form['Notice Period']}\n\nClient signature: ____________________\nAgency signature: ____________________\n\nINVOICE DRAFT\nClient: ${form['Company Name']}\nDescription: ${form['Project Name']}\nMonthly Fee: ${form['Monthly Fee']}\nTax: ${form['Tax Rate']}\nPayment Terms: ${form['Payment Terms']}\n`;
  return (
    <>
      <Heading title="Agreement Generator" />
      <p className="ws-hint">
        This saves your draft and downloads a text copy. Use the Records tab to
        create the agreement and Finance to create an invoice.
      </p>
      {error && <p role="alert">{error}</p>}
      {busy && <p>Saving draft…</p>}
      <div className="ws-agreement-grid">
        <section>
          <div className="ws-steps">
            {steps.map((label, i) => (
              <button
                key={label}
                className={step === i ? 'selected' : ''}
                onClick={() => setStep(i)}
              >
                <span>{i + 1}</span>
                {label}
                {i < 3 && <ChevronRight size={12} />}
              </button>
            ))}
          </div>
          <Panel title={step === 0 ? 'Client Information' : steps[step]}>
            {step < 3 ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setStep(step + 1);
                }}
              >
                <div className="ws-form-grid">
                  {fields[step].map((field) => (
                    <label key={field}>
                      {field}
                      {!field.includes('Optional') && <em> *</em>}
                      <Input
                        required={!field.includes('Optional')}
                        type={field === 'Email' ? 'email' : 'text'}
                        value={form[field] || ''}
                        onChange={(e) =>
                          setForm({ ...form, [field]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="ws-form-footer">
                  {step > 0 && (
                    <Action secondary onClick={() => setStep(step - 1)}>
                      Back
                    </Action>
                  )}
                  <Action type="submit">
                    Continue
                    <ChevronRight size={14} />
                  </Action>
                </div>
              </form>
            ) : (
              <>
                <dl className="ws-review">
                  {Object.entries(form).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <Action
                  onClick={async () => {
                    try {
                      await saveDocument('agreement-draft', form);
                      downloadText(
                        'agreement-and-invoice-draft.txt',
                        agreement,
                      );
                      setError('');
                    } catch (error) {
                      setError(
                        error instanceof Error ? error.message : 'Save failed.',
                      );
                    }
                  }}
                >
                  <Download size={14} />
                  Save & Download Draft
                </Action>
              </>
            )}
          </Panel>
        </section>
        <Panel title="Agreement Preview">
          <div className="ws-paper">
            <div className="ws-paper-brand">
              <strong>{agencyName}</strong>
              <span className="ws-client-logo">
                <Building2 size={22} />
              </span>
            </div>
            <h4>MASTER SERVICES AGREEMENT</h4>
            <p>
              This agreement is between {agencyName} and{' '}
              <strong>{form['Company Name']}</strong>.
            </p>
            <h5>01 · Scope of Services</h5>
            <p>{form.Services}</p>
            <h5>02 · Term & Commercials</h5>
            <p>
              {form['Start Date']} – {form['End Date']}
            </p>
            <p>
              {form['Monthly Fee']} / month · Tax {form['Tax Rate']}
            </p>
            <p>{form['Payment Terms']}</p>
            <div className="ws-signatures">
              <span>Client Signature</span>
              <span>Agency Signature</span>
            </div>
          </div>
          <Action onClick={() => setStep(3)}>
            <Download size={14} />
            Review Agreement & Invoice
          </Action>
        </Panel>
      </div>
    </>
  );
}

function TeamView() {
  const [tab, setTab] = useState('Team');
  return (
    <>
      <Tabs
        items={['Team', 'Tasks', 'Daily Activity', 'Calls', 'Time Tracking']}
        active={tab}
        onChange={setTab}
      />
      {tab === 'Team' ? (
        <ResourceView resource="users" />
      ) : tab === 'Tasks' ? (
        <ResourceView resource="tasks" />
      ) : (
        <p className="ws-empty">{tab} tracking is not connected yet.</p>
      )}
    </>
  );
}
function TasksView({ calendar }: { calendar: boolean }) {
  const { user, save, busy } = useCrm();
  const tasks = useRecords('tasks');
  const [tab, setTab] = useState(calendar ? 'Calendar' : 'My Tasks');
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const month = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const firstDay = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const key =
    month.getFullYear() + '-' + String(month.getMonth() + 1).padStart(2, '0');
  return (
    <>
      <Heading title="Tasks & Calendar" />
      <Tabs
        items={['My Tasks', 'Team Tasks', 'Calendar']}
        active={tab}
        onChange={setTab}
      />
      {tab !== 'Calendar' ? (
        <>
          <ResourceView
            resource="tasks"
            filter={
              tab === 'My Tasks'
                ? (row) => Number(row.assignee_id) === user.id
                : undefined
            }
          />
          <Panel title="Quick Completion">
            <div className="ws-due-list">
              {tasks
                .filter(
                  (row) =>
                    tab !== 'My Tasks' || Number(row.assignee_id) === user.id,
                )
                .map((row) => (
                  <label
                    key={row.id}
                    style={{ display: 'flex', gap: 10, padding: 10 }}
                  >
                    <input
                      type="checkbox"
                      aria-label={'Complete ' + text(row, 'title')}
                      checked={row.status === 'Completed'}
                      disabled={busy}
                      onChange={async (e) => {
                        try {
                          await save('tasks', {
                            id: row.id,
                            status: e.target.checked
                              ? 'Completed'
                              : 'Not started',
                          });
                        } catch {
                          /* Provider displays the failure. */
                        }
                      }}
                    />
                    {text(row, 'title')}
                  </label>
                ))}
            </div>
          </Panel>
        </>
      ) : (
        <section className="ws-calendar">
          <div className="ws-subtoolbar">
            <h4>
              {month.toLocaleDateString('en', {
                month: 'long',
                year: 'numeric',
              })}
            </h4>
            <div className="ws-actions">
              <button
                aria-label="Previous month"
                onClick={() => setOffset(offset - 1)}
              >
                <ChevronLeft />
              </button>
              <button onClick={() => setOffset(0)}>Today</button>
              <button
                aria-label="Next month"
                onClick={() => setOffset(offset + 1)}
              >
                <ChevronRight />
              </button>
            </div>
          </div>
          <div className="ws-calendar-grid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <strong key={day}>{day}</strong>
            ))}
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={'blank-' + i} className="blank" />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const date = key + '-' + String(i + 1).padStart(2, '0');
              return (
                <div key={date} className={date === today() ? 'today' : ''}>
                  <time>{i + 1}</time>
                  {tasks
                    .filter((row) => String(row.due_date).slice(0, 10) === date)
                    .map((row) => (
                      <button key={row.id} onClick={() => setTab('Team Tasks')}>
                        {text(row, 'title')}
                      </button>
                    ))}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
type Asset = { name: string; url: string; projectId: number };
function AssetsView({ projectId }: { projectId: number }) {
  const { data, saveDocument } = useCrm();
  const [create, setCreate] = useState(false);
  const assets = (data.documents.assets?.value || []) as Asset[];
  return (
    <>
      <Heading title="Project Files">
        <Action onClick={() => setCreate(true)}>
          <Plus size={14} />
          Add File Link
        </Action>
      </Heading>
      <p className="ws-hint">
        Link a file already stored in your document service.
      </p>
      <DataTable
        columns={['File', 'Link']}
        rows={assets
          .filter((asset) => asset.projectId === projectId)
          .map((asset) => [
            asset.name,
            /^https?:\/\//i.test(asset.url) ? (
              <a
                key={asset.url}
                href={asset.url}
                target="_blank"
                rel="noreferrer"
              >
                Open file
              </a>
            ) : (
              'Invalid link'
            ),
          ])}
      />
      <RecordForm
        title="Add File Link"
        open={create}
        onClose={() => setCreate(false)}
        fields={['Name', 'URL']}
        onSave={async (value) => {
          const url = new URL(value.URL);
          if (!['https:', 'http:'].includes(url.protocol))
            throw Error('Use an HTTPS or HTTP file URL.');
          await saveDocument('assets', [
            ...assets,
            { name: value.Name, url: url.href, projectId },
          ]);
        }}
      />
    </>
  );
}
function SettingsView() {
  const { data, user, saveDocument, busy } = useCrm();
  const [tab, setTab] = useState('Workspace');
  const [saved, setSaved] = useState(false);
  const current = (data.documents.settings?.value || {}) as { name?: string };
  const [name, setName] = useState(current.name || '');
  return (
    <>
      <Heading title="Settings" />
      <Tabs
        items={['Workspace', 'Notifications', 'Integrations']}
        active={tab}
        onChange={setTab}
      />
      {tab === 'Integrations' ? (
        <Panel title="Connected Services">
          <p>CRM API · Connected to your workspace database</p>
        </Panel>
      ) : tab === 'Notifications' ? (
        <p className="ws-empty">Notification delivery is not configured yet.</p>
      ) : (
        <Panel title="Workspace Profile">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await saveDocument('settings', { ...current, name });
                setSaved(true);
              } catch {
                setSaved(false);
              }
            }}
          >
            <label htmlFor="workspace-name">
              Workspace Name
              <Input
                id="workspace-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                disabled={user.role !== 'admin'}
                required
              />
            </label>
            <p>
              Signed in as {user.name} · {user.email}
            </p>
            <Button
              type="submit"
              disabled={busy || user.role !== 'admin'}
              className="ws-button"
            >
              {saved ? 'Saved' : 'Save Changes'}
            </Button>
          </form>
        </Panel>
      )}
    </>
  );
}
