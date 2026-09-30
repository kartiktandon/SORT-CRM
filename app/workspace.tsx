'use client';

import { useId, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileCheck2,
  LayoutGrid,
  List,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  useCrm,
  useRecords,
  text,
  money,
  dateLabel,
  type RecordData,
} from './crm-data';
import './workspace.css';
import LeadsExplorer from './leads';
import DraggableWidgetGridDemo, {
  type DashboardMetrics,
} from '@/components/ui/draggable-widget-grid-demo';

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
  const tone = /Active|Paid|Submitted|On Track|Completed|Won|Closed|Approved|Profitable/.test(value)
    ? 'green'
    : /Pending|Onboarding|Attention|Warm/.test(value)
      ? 'amber'
      : /Overdue|Delayed|Not Started|Hot|Lost|Rejected|Deficit/.test(value)
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
  kind?: 'number' | 'date' | 'email' | 'password' | 'url' | 'textarea';
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
      field('password', 'Password', { kind: 'password', required: true }),
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
  expenses: {
    title: 'Company Expenses',
    singular: 'Expense',
    fields: [
      field('title', 'Expense / Item Name', { required: true }),
      field('category', 'Category', {
        options: [
          'Software & Tools',
          'Salaries & Contractors',
          'Marketing & Ads',
          'Office & Rent',
          'Travel & Entertainment',
          'Utilities',
          'Legal & Professional',
          'Hardware & Equipment',
          'Other',
        ],
        required: true,
      }),
      field('amount', 'Amount', { kind: 'number', required: true }),
      field('date', 'Date', { kind: 'date', required: true }),
      field('payment_method', 'Payment Method', {
        options: ['Credit Card', 'Bank Transfer', 'UPI', 'Cash', 'Other'],
      }),
      statusField(['Pending', 'Approved', 'Paid', 'Rejected']),
      field('vendor', 'Vendor / Payee'),
      field('notes', 'Notes', { kind: 'textarea' }),
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
  const { data, save, remove, user, busy } = useCrm();
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
  const [passwordVisible, setPasswordVisible] = useState(false);
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
          {resource === 'users'
            ? record.id
              ? 'Update this member’s details. Leave password blank to keep the current password.'
              : 'Create separate login credentials for this team member. Passwords must be at least 6 characters.'
            : 'Changes are saved to your workspace database.'}
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
                if (f.kind === 'password' && record.id && !value) continue;
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
              ) : f.kind === 'password' ? (
                <div className="ws-password-field">
                  <Input
                    type={passwordVisible ? 'text' : 'password'}
                    required={!record.id}
                    minLength={6}
                    autoComplete="new-password"
                    placeholder={
                      record.id ? 'Leave blank to keep current password' : undefined
                    }
                    value={values[f.key]}
                    onChange={(e) =>
                      setValues({ ...values, [f.key]: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    className="ws-password-toggle"
                    onClick={() => setPasswordVisible((visible) => !visible)}
                    aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                    aria-pressed={passwordVisible}
                  >
                    {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
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
            {Boolean(
              record.id &&
                (resource === 'expenses' ||
                  resource === 'leads' ||
                  user.role === 'admin'),
            ) && (
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={async () => {
                  if (
                    window.confirm(
                      `Are you sure you want to delete this ${definition.singular.toLowerCase()}?`,
                    )
                  ) {
                    await remove(resource, record.id!);
                    onClose();
                  }
                }}
                style={{ marginRight: 'auto' }}
              >
                Delete
              </Button>
            )}
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
  const { data, user, remove } = useCrm();
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
  const canDelete =
    resource === 'leads' || resource === 'expenses' || user.role === 'admin';
  const columns = definition.fields.filter(
    (f) => f.kind !== 'textarea' && f.key !== 'document_url',
  );
  const display = (row: RecordData, f: Field): ReactNode => {
    if (f.kind === 'password')
      return row.has_login ? (
        <span className="ws-login-ready" title="A password is configured">
          ••••••••
        </span>
      ) : (
        <span className="ws-login-missing">Not set</span>
      );
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
            {canDelete && (
              <button
                className="ws-link danger"
                onClick={async () => {
                  if (
                    window.confirm(
                      `Are you sure you want to delete this ${definition.singular.toLowerCase()}?`,
                    )
                  ) {
                    await remove(resource, row.id);
                  }
                }}
              >
                Delete
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
          Each active member can sign in with their email and password. Passwords are
          securely hashed and cannot be viewed later; use Edit to set a new one.
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
      {active === 'Finance' && <FinanceView initialTab="Overview" />}
      {active === 'Expenses' && <FinanceView initialTab="Expenses" />}
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
    expenses = useRecords('expenses'),
    tasks = useRecords('tasks');
  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);
  const paid = invoices.filter((row) => row.status === 'Paid');
  const total = (rows: RecordData[]) =>
    rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const revenue = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const key =
      date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
    return {
      month: date.toLocaleDateString('en', { month: 'short', year: '2-digit' }),
      amount: total(
        paid.filter((row) => String(row.issue_date || '').startsWith(key)),
      ),
      expenses: total(
        expenses.filter((row) => String(row.date || '').startsWith(key)),
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
  const dashboardMetrics: DashboardMetrics = {
    leads: leads.length,
    activeClients: clients.filter((row) => row.status === 'Active').length,
    ongoingProjects: projects.filter((row) => row.status !== 'Completed').length,
    teamMembers: users.length,
    paidThisMonth: total(
      paid.filter((row) => String(row.issue_date || '').startsWith(monthKey)),
    ),
    expensesThisMonth: total(
      expenses.filter((row) => String(row.date || '').startsWith(monthKey)),
    ),
    revenue,
    projectStatuses: ['Not started', 'In progress', 'On hold', 'Completed'].map(
      (status) => ({
        label: status,
        value: projects.filter((row) => row.status === status).length,
      }),
    ),
    tasks: due.map((task) => ({
      id: task.id,
      title: text(task, 'title'),
      dueDate: dateLabel(task.due_date),
    })),
  };
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
      <p className="ws-dashboard-hint">
        Drag and rearrange widgets to customize your dashboard.
      </p>
      <DraggableWidgetGridDemo metrics={dashboardMetrics} onNavigate={navigate} />
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
function FinanceView({ initialTab = 'Overview' }: { initialTab?: string }) {
  const invoices = useRecords('invoices');
  const expenses = useRecords('expenses');
  const [tab, setTab] = useState(initialTab);
  const [month, setMonth] = useState('All months');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const months = Array.from(
    new Set([
      ...invoices.map((row) => String(row.issue_date || '').slice(0, 7)),
      ...expenses.map((row) => String(row.date || '').slice(0, 7)),
    ].filter(Boolean)),
  )
    .sort()
    .reverse();

  const invoiceRows = invoices.filter(
    (row) =>
      month === 'All months' || String(row.issue_date || '').startsWith(month),
  );
  const allExpenseRowsForMonth = expenses.filter(
    (row) =>
      month === 'All months' || String(row.date || '').startsWith(month),
  );
  const totalInvoiced = invoiceRows.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0,
  );
  const totalCollected = invoiceRows
    .filter((row) => row.status === 'Paid')
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const pendingInvoiced = invoiceRows
    .filter((row) => row.status === 'Pending' || row.status === 'Draft')
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const totalExpenses = allExpenseRowsForMonth.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0,
  );
  const paidExpenses = allExpenseRowsForMonth
    .filter((row) => row.status === 'Paid' || !row.status)
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const pendingExpenses = allExpenseRowsForMonth
    .filter((row) => row.status === 'Pending' || row.status === 'Approved')
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const netOperatingProfit = totalCollected - totalExpenses;
  const marginPct =
    totalCollected > 0
      ? ((netOperatingProfit / totalCollected) * 100).toFixed(1)
      : '0';

  const categoryTotals: Record<string, number> = {};
  for (const exp of allExpenseRowsForMonth) {
    const cat = String(exp.category || 'Other');
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(exp.amount || 0);
  }
  const sortedCategories = Object.entries(categoryTotals).sort(
    (a, b) => b[1] - a[1],
  );
  const topCategory = sortedCategories[0];

  const categories = [
    'All',
    'Software & Tools',
    'Salaries & Contractors',
    'Marketing & Ads',
    'Office & Rent',
    'Travel & Entertainment',
    'Utilities',
    'Legal & Professional',
    'Hardware & Equipment',
    'Other',
  ];

  return (
    <>
      <Heading title="Finance & Spending Center">
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
          'Expenses',
          'Profit & Loss',
          'Agreements',
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'Overview' && (
        <>
          <div className="ws-stats">
            <article>
              <span>Total Invoiced</span>
              <strong>{money(totalInvoiced)}</strong>
            </article>
            <article>
              <span>Collected Revenue</span>
              <strong className="text-emerald-600">{money(totalCollected)}</strong>
            </article>
            <article>
              <span>Company Spending</span>
              <strong className="text-rose-600">{money(totalExpenses)}</strong>
            </article>
            <article>
              <span>Net Operating Profit</span>
              <strong
                className={
                  netOperatingProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }
              >
                {money(netOperatingProfit)}
              </strong>
            </article>
            <article>
              <span>Net Margin</span>
              <strong>{marginPct}%</strong>
            </article>
          </div>

          <div className="ws-finance-grid">
            <Panel title="Financial Performance Summary">
              <div className="ws-fin-summary-card">
                <div className="ws-fin-metric-row">
                  <div className="ws-fin-metric-label">
                    <span className="ws-fin-dot green" />
                    <span>Collected Revenue</span>
                  </div>
                  <strong className="text-emerald-600">{money(totalCollected)}</strong>
                </div>
                <div className="ws-fin-metric-row">
                  <div className="ws-fin-metric-label">
                    <span className="ws-fin-dot red" />
                    <span>Company Spending</span>
                  </div>
                  <strong className="text-rose-600">{money(totalExpenses)}</strong>
                </div>
                <div className="ws-fin-metric-row">
                  <div className="ws-fin-metric-label">
                    <span className="ws-fin-dot amber" />
                    <span>Pending Receivables</span>
                  </div>
                  <strong>{money(pendingInvoiced)}</strong>
                </div>
                <div className="ws-fin-metric-row border-t pt-3 mt-2">
                  <div className="ws-fin-metric-label">
                    <strong>Net Profit (Collected - Expenses)</strong>
                  </div>
                  <strong
                    className={
                      netOperatingProfit >= 0
                        ? 'text-emerald-600 text-base'
                        : 'text-rose-600 text-base'
                    }
                  >
                    {money(netOperatingProfit)}
                  </strong>
                </div>
                {totalCollected > 0 && (
                  <div className="ws-fin-progress-wrap mt-4">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                      <span>Expense Ratio ({totalExpenses > 0 ? ((totalExpenses / totalCollected) * 100).toFixed(0) : 0}%)</span>
                      <span>Profit Retention ({marginPct}%)</span>
                    </div>
                    <div className="ws-fin-split-bar">
                      <div
                        className="ws-fin-split-expense"
                        style={{
                          width: `${Math.min(
                            100,
                            totalCollected > 0
                              ? (totalExpenses / totalCollected) * 100
                              : 0,
                          )}%`,
                        }}
                      />
                      <div
                        className="ws-fin-split-profit"
                        style={{
                          width: `${Math.max(
                            0,
                            totalCollected > 0
                              ? (netOperatingProfit / totalCollected) * 100
                              : 0,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Panel>

            <Panel title="Top Spending Categories">
              {sortedCategories.length === 0 ? (
                <p className="ws-empty">No expenses logged for this period.</p>
              ) : (
                <div className="ws-categories-breakdown">
                  {sortedCategories.slice(0, 5).map(([cat, amt]) => {
                    const pct =
                      totalExpenses > 0
                        ? ((amt / totalExpenses) * 100).toFixed(0)
                        : '0';
                    return (
                      <div key={cat} className="ws-cat-row">
                        <div className="ws-cat-info">
                          <span className="ws-cat-name">{cat}</span>
                          <span className="ws-cat-amt">
                            {money(amt)} ({pct}%)
                          </span>
                        </div>
                        <div className="ws-cat-bar-bg">
                          <div
                            className="ws-cat-bar-fill"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div className="mt-3 text-right">
                    <button
                      type="button"
                      className="ws-link text-xs"
                      onClick={() => setTab('Expenses')}
                    >
                      View All Expenses &rarr;
                    </button>
                  </div>
                </div>
              )}
            </Panel>
          </div>
        </>
      )}

      {tab === 'Expenses' && (
        <div className="ws-expenses-section">
          <div className="ws-stats">
            <article>
              <span>Total Spending</span>
              <strong className="text-rose-600">{money(totalExpenses)}</strong>
            </article>
            <article>
              <span>Paid Out</span>
              <strong>{money(paidExpenses)}</strong>
            </article>
            <article>
              <span>Pending / Due</span>
              <strong className="text-amber-600">{money(pendingExpenses)}</strong>
            </article>
            <article>
              <span>Top Spending Category</span>
              <strong>
                {topCategory
                  ? `${topCategory[0]} (${money(topCategory[1])})`
                  : '—'}
              </strong>
            </article>
          </div>

          <div className="ws-expense-category-pills">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`ws-cat-pill ${categoryFilter === cat ? 'active' : ''}`}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat}
                {cat !== 'All' && categoryTotals[cat]
                  ? ` · ${money(categoryTotals[cat])}`
                  : ''}
              </button>
            ))}
          </div>

          <ResourceView
            resource="expenses"
            filter={(row) =>
              (month === 'All months' ||
                String(row.date || '').startsWith(month)) &&
              (categoryFilter === 'All' || row.category === categoryFilter)
            }
          />
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

      {tab === 'Profit & Loss' && (
        <div className="ws-pnl-section">
          <div className="ws-stats">
            <article>
              <span>Collected Revenue</span>
              <strong className="text-emerald-600">{money(totalCollected)}</strong>
            </article>
            <article>
              <span>Total Company Expenses</span>
              <strong className="text-rose-600">{money(totalExpenses)}</strong>
            </article>
            <article>
              <span>Net Operating Profit</span>
              <strong
                className={
                  netOperatingProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }
              >
                {money(netOperatingProfit)}
              </strong>
            </article>
            <article>
              <span>Profit Margin</span>
              <strong>{marginPct}%</strong>
            </article>
          </div>

          <Panel title="Monthly Profit & Loss Statement">
            {months.length === 0 ? (
              <p className="ws-empty">No financial records available yet.</p>
            ) : (
              <DataTable
                columns={[
                  'Month',
                  'Invoiced',
                  'Collected Revenue',
                  'Company Expenses',
                  'Net Profit',
                  'Status',
                ]}
                rows={months.map((m) => {
                  const mInvoices = invoices.filter((r) =>
                    String(r.issue_date || '').startsWith(m),
                  );
                  const mExpenses = expenses.filter((r) =>
                    String(r.date || '').startsWith(m),
                  );
                  const mBilled = mInvoices.reduce(
                    (s, r) => s + Number(r.amount || 0),
                    0,
                  );
                  const mPaid = mInvoices
                    .filter((r) => r.status === 'Paid')
                    .reduce((s, r) => s + Number(r.amount || 0), 0);
                  const mSpent = mExpenses.reduce(
                    (s, r) => s + Number(r.amount || 0),
                    0,
                  );
                  const mProfit = mPaid - mSpent;
                  return [
                    m,
                    money(mBilled),
                    money(mPaid),
                    money(mSpent),
                    <strong
                      key={m}
                      className={
                        mProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }
                    >
                      {money(mProfit)}
                    </strong>,
                    <Badge
                      key={`b-${m}`}
                      value={mProfit >= 0 ? 'Profitable' : 'Deficit'}
                    />,
                  ];
                })}
              />
            )}
          </Panel>
        </div>
      )}

      {tab === 'Agreements' && <ResourceView resource="agreements" />}
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
export const NOVERA_BOILERPLATE: Record<string, string> = {
  quotationNo: 'QT-2026-101',
  date: '18 Sept 2026',
  clientName: 'ZaapMed',
  projectName: 'Pharmacy Order Processing & Fulfilment System',
  agencyName: 'NOVERA LABS',
  deliverablesSummary: 'Customer Web App · Admin Dashboard · Chemist Portal',
  scope1Title: '1. Customer Web Application',
  scope1Items:
    '• Secure WhatsApp-linked order entry/session\n• Medicine search, exact product selection and cart\n• 50 GB MySql database free & Website hosting\n• Indicative order summary and order submission',
  scope2Title: '2. Admin Dashboard',
  scope2Items:
    '• Order/customer management and unique Order ID\n• Chemist allocation and response comparison\n• Multi-chemist item allocation and finalisation\n• Final summary, customer confirmation/rejection and status management',
  scope3Title: '3. Chemist Portal',
  scope3Items:
    '• View allocated orders/items\n• Verify availability, quantity, current MRP, discount and remarks\n• Prescription verification where required\n• Re-verification and packing-status updates',
  scope4Title: '4. Medicine Data & Pricing',
  scope4Items:
    '• Import and integrate client-supplied medicine master Excel data\n• Product ID-based medicine identification and search\n• Configured serviceability, discount, handling and distance-charge rules\n• Final pricing based on verified chemist information',
  scope5Title: '5. Notifications, Security & Audit',
  scope5Items:
    '• WhatsApp notifications and secure action links\n• Role-based access for Customer, Admin and Chemist\n• Relevant order/status audit information\n• AI-assisted WhatsApp architecture for approved information lookup/actions, where applicable',
  exclusions:
    '• Rider Portal and rider-side delivery/GPS operations\n• WhatsApp, AI, Maps/location, payment/UPI, hosting, SMS/email and other third-party usage charges\n• Independent medical validation, correction or enrichment of client-supplied medicine data\n• New features or integrations outside the agreed scope',
  totalProjectValue: '₹2,00,000',
  paymentTerms:
    '40% Advance: ₹80,000 | 30% Milestone: ₹60,000 | 30% Final: ₹60,000',
  keyTerms:
    '• TAT of 20 working days starts after advance payment and receipt of required data, credentials, approvals and third-party access.\n• Client is responsible for the accuracy, legality and completeness of supplied medicine/product information.\n• Material changes or additions to scope will be estimated and quoted separately.',
  footerText:
    'NOVERA LABS | Custom Technology Solutions Pharmacy Order Processing & Fulfilment System',
};

function renderQuotationBullets(text: string | undefined) {
  if (!text) return null;
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return (
    <ul className="ws-q-bullets">
      {lines.map((line, idx) => {
        const clean = line.replace(/^[•\-\*]\s*/, '');
        return (
          <li key={idx} className="ws-q-bullet-item">
            <span className="ws-q-bullet-dot">•</span>
            <span className="ws-q-bullet-text">{clean}</span>
          </li>
        );
      })}
    </ul>
  );
}

function AgreementGenerator() {
  const [step, setStep] = useState(0);
  const { data, saveDocument, busy } = useCrm();
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');

  const [form, setForm] = useState<Record<string, string>>(() => {
    const saved = (data.documents['agreement-draft']?.value || {}) as Record<
      string,
      string
    >;
    return {
      ...NOVERA_BOILERPLATE,
      ...saved,
      clientName:
        saved.clientName ||
        saved['Client Name'] ||
        saved['Company Name'] ||
        NOVERA_BOILERPLATE.clientName,
      projectName:
        saved.projectName ||
        saved['Project Name'] ||
        NOVERA_BOILERPLATE.projectName,
    };
  });

  const steps = [
    'Quotation & Client',
    'Scope & Deliverables',
    'Commercials & Terms',
    'Review & Generate',
  ];

  const handleSaveDraft = async () => {
    try {
      await saveDocument('agreement-draft', form);
      setNotification('Draft saved successfully to CRM documents!');
      setTimeout(() => setNotification(''), 3500);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    }
  };

  const agreementText = `QUOTATION / MASTER SERVICE PROPOSAL
Quotation No.: ${form.quotationNo}
Date: ${form.date}
Prepared For: ${form.clientName}
Project: ${form.projectName}
Issued By: ${form.agencyName}

DELIVERABLES:
${form.deliverablesSummary}

1. CUSTOMER WEB APPLICATION:
${form.scope1Items}

2. ADMIN DASHBOARD:
${form.scope2Items}

3. CHEMIST PORTAL:
${form.scope3Items}

4. MEDICINE DATA & PRICING:
${form.scope4Items}

5. NOTIFICATIONS, SECURITY & AUDIT:
${form.scope5Items}

EXCLUSIONS & THIRD-PARTY COSTS:
${form.exclusions}

COMMERCIALS:
Total Project Value: ${form.totalProjectValue}
Payment Terms: ${form.paymentTerms}

KEY TERMS:
${form.keyTerms}

${form.footerText}
`;

  return (
    <>
      <div className="ws-generator-header">
        <div>
          <Heading title="Agreement & Quotation Generator" />
          <p className="ws-hint">
            Prefilled with the Novera Labs quotation boilerplate. Modify details
            below or print directly to PDF.
          </p>
        </div>
        <div className="ws-generator-toolbar">
          <Button
            type="button"
            variant="outline"
            className="ws-toolbar-btn ws-btn-preset"
            onClick={() => {
              setForm({ ...NOVERA_BOILERPLATE });
              setNotification('Loaded Novera Labs quotation boilerplate!');
              setTimeout(() => setNotification(''), 3500);
            }}
          >
            <Sparkles size={14} className="text-amber-500 mr-1.5" />
            Load Novera Preset
          </Button>
          <Button
            type="button"
            variant="outline"
            className="ws-toolbar-btn"
            onClick={() => window.print()}
          >
            <Printer size={14} className="text-sky-500 mr-1.5" />
            Print / Save PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            className="ws-toolbar-btn"
            onClick={handleSaveDraft}
          >
            <Download size={14} className="text-emerald-500 mr-1.5" />
            Save Draft
          </Button>
        </div>
      </div>

      {notification && (
        <div className="ws-banner-success">
          <FileCheck2 size={16} />
          <span>{notification}</span>
        </div>
      )}
      {error && <p className="ws-banner-error" role="alert">{error}</p>}
      {busy && <p className="ws-hint">Saving draft…</p>}

      <div className="ws-agreement-grid">
        <section>
          <div className="ws-steps">
            {steps.map((label, i) => (
              <button
                key={label}
                className={step === i ? 'selected' : ''}
                onClick={() => setStep(i)}
                type="button"
              >
                <span>{i + 1}</span>
                {label}
                {i < steps.length - 1 && <ChevronRight size={12} />}
              </button>
            ))}
          </div>

          <Panel title={steps[step]}>
            {step === 0 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setStep(1);
                }}
              >
                <div className="ws-form-grid">
                  <label>
                    Quotation No. <em>*</em>
                    <Input
                      required
                      value={form.quotationNo || ''}
                      onChange={(e) =>
                        setForm({ ...form, quotationNo: e.target.value })
                      }
                      placeholder="e.g. QT-2026-101"
                    />
                  </label>
                  <label>
                    Date <em>*</em>
                    <Input
                      required
                      value={form.date || ''}
                      onChange={(e) =>
                        setForm({ ...form, date: e.target.value })
                      }
                      placeholder="e.g. 18 Sept 2026"
                    />
                  </label>
                  <label>
                    Client Name (Prepared For) <em>*</em>
                    <Input
                      required
                      value={form.clientName || ''}
                      onChange={(e) =>
                        setForm({ ...form, clientName: e.target.value })
                      }
                      placeholder="e.g. ZaapMed"
                    />
                  </label>
                  <label>
                    Agency / Issuer Name <em>*</em>
                    <Input
                      required
                      value={form.agencyName || ''}
                      onChange={(e) =>
                        setForm({ ...form, agencyName: e.target.value })
                      }
                      placeholder="e.g. NOVERA LABS"
                    />
                  </label>
                  <label className="ws-col-span-full">
                    Project Name <em>*</em>
                    <Input
                      required
                      value={form.projectName || ''}
                      onChange={(e) =>
                        setForm({ ...form, projectName: e.target.value })
                      }
                      placeholder="e.g. Pharmacy Order Processing & Fulfilment System"
                    />
                  </label>
                  <label className="ws-col-span-full">
                    Deliverables Highlight <em>*</em>
                    <Input
                      required
                      value={form.deliverablesSummary || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          deliverablesSummary: e.target.value,
                        })
                      }
                      placeholder="e.g. Customer Web App · Admin Dashboard · Chemist Portal"
                    />
                  </label>
                </div>
                <div className="ws-form-footer">
                  <Action type="submit">
                    Continue to Scope
                    <ChevronRight size={14} />
                  </Action>
                </div>
              </form>
            )}

            {step === 1 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setStep(2);
                }}
              >
                <div className="ws-form-vertical">
                  <div className="ws-scope-edit-group">
                    <label>
                      <strong>Scope 1 Title</strong>
                      <Input
                        value={form.scope1Title || ''}
                        onChange={(e) =>
                          setForm({ ...form, scope1Title: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Scope 1 Deliverables (one bullet per line)</span>
                      <Textarea
                        rows={4}
                        value={form.scope1Items || ''}
                        onChange={(e) =>
                          setForm({ ...form, scope1Items: e.target.value })
                        }
                      />
                    </label>
                  </div>

                  <div className="ws-scope-edit-group">
                    <label>
                      <strong>Scope 2 Title</strong>
                      <Input
                        value={form.scope2Title || ''}
                        onChange={(e) =>
                          setForm({ ...form, scope2Title: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Scope 2 Deliverables (one bullet per line)</span>
                      <Textarea
                        rows={4}
                        value={form.scope2Items || ''}
                        onChange={(e) =>
                          setForm({ ...form, scope2Items: e.target.value })
                        }
                      />
                    </label>
                  </div>

                  <div className="ws-scope-edit-group">
                    <label>
                      <strong>Scope 3 Title</strong>
                      <Input
                        value={form.scope3Title || ''}
                        onChange={(e) =>
                          setForm({ ...form, scope3Title: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Scope 3 Deliverables (one bullet per line)</span>
                      <Textarea
                        rows={4}
                        value={form.scope3Items || ''}
                        onChange={(e) =>
                          setForm({ ...form, scope3Items: e.target.value })
                        }
                      />
                    </label>
                  </div>

                  <div className="ws-scope-edit-group">
                    <label>
                      <strong>Scope 4 Title</strong>
                      <Input
                        value={form.scope4Title || ''}
                        onChange={(e) =>
                          setForm({ ...form, scope4Title: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Scope 4 Deliverables (one bullet per line)</span>
                      <Textarea
                        rows={4}
                        value={form.scope4Items || ''}
                        onChange={(e) =>
                          setForm({ ...form, scope4Items: e.target.value })
                        }
                      />
                    </label>
                  </div>

                  <div className="ws-scope-edit-group">
                    <label>
                      <strong>Scope 5 Title</strong>
                      <Input
                        value={form.scope5Title || ''}
                        onChange={(e) =>
                          setForm({ ...form, scope5Title: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Scope 5 Deliverables (one bullet per line)</span>
                      <Textarea
                        rows={4}
                        value={form.scope5Items || ''}
                        onChange={(e) =>
                          setForm({ ...form, scope5Items: e.target.value })
                        }
                      />
                    </label>
                  </div>
                </div>

                <div className="ws-form-footer">
                  <Action secondary onClick={() => setStep(0)}>
                    Back
                  </Action>
                  <Action type="submit">
                    Continue to Commercials
                    <ChevronRight size={14} />
                  </Action>
                </div>
              </form>
            )}

            {step === 2 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setStep(3);
                }}
              >
                <div className="ws-form-grid">
                  <label>
                    Total Project Value <em>*</em>
                    <Input
                      required
                      value={form.totalProjectValue || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          totalProjectValue: e.target.value,
                        })
                      }
                      placeholder="e.g. ₹2,00,000"
                    />
                  </label>
                  <label className="ws-col-span-full">
                    Payment Terms <em>*</em>
                    <Input
                      required
                      value={form.paymentTerms || ''}
                      onChange={(e) =>
                        setForm({ ...form, paymentTerms: e.target.value })
                      }
                      placeholder="e.g. 40% Advance: ₹80,000 | 30% Milestone: ₹60,000 | 30% Final: ₹60,000"
                    />
                  </label>
                  <label className="ws-col-span-full">
                    Exclusions & Third-Party Costs
                    <Textarea
                      rows={4}
                      value={form.exclusions || ''}
                      onChange={(e) =>
                        setForm({ ...form, exclusions: e.target.value })
                      }
                    />
                  </label>
                  <label className="ws-col-span-full">
                    Key Terms
                    <Textarea
                      rows={3}
                      value={form.keyTerms || ''}
                      onChange={(e) =>
                        setForm({ ...form, keyTerms: e.target.value })
                      }
                    />
                  </label>
                  <label className="ws-col-span-full">
                    Footer Credit / Tagline
                    <Input
                      value={form.footerText || ''}
                      onChange={(e) =>
                        setForm({ ...form, footerText: e.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="ws-form-footer">
                  <Action secondary onClick={() => setStep(1)}>
                    Back
                  </Action>
                  <Action type="submit">
                    Review & Generate
                    <ChevronRight size={14} />
                  </Action>
                </div>
              </form>
            )}

            {step === 3 && (
              <div className="ws-review-panel">
                <dl className="ws-review">
                  <div>
                    <dt>Quotation</dt>
                    <dd>
                      {form.quotationNo} · {form.date}
                    </dd>
                  </div>
                  <div>
                    <dt>Client</dt>
                    <dd>{form.clientName}</dd>
                  </div>
                  <div>
                    <dt>Project</dt>
                    <dd>{form.projectName}</dd>
                  </div>
                  <div>
                    <dt>Deliverables</dt>
                    <dd>{form.deliverablesSummary}</dd>
                  </div>
                  <div>
                    <dt>Total Value</dt>
                    <dd>
                      <strong>{form.totalProjectValue}</strong>
                    </dd>
                  </div>
                  <div>
                    <dt>Payment Terms</dt>
                    <dd>{form.paymentTerms}</dd>
                  </div>
                </dl>

                <div className="ws-review-actions">
                  <Button
                    type="button"
                    className="ws-btn-primary"
                    onClick={() => window.print()}
                  >
                    <Printer size={15} className="mr-2" />
                    Print / Export PDF Now
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveDraft}
                  >
                    <Download size={15} className="mr-2" />
                    Save to CRM Documents
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      downloadText(
                        `${form.quotationNo || 'quotation'}-${form.clientName || 'client'}.txt`,
                        agreementText,
                      )
                    }
                  >
                    Download Plain Text
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-amber-600"
                    onClick={() => {
                      setForm({ ...NOVERA_BOILERPLATE });
                      setNotification('Reset to Novera Labs template!');
                      setTimeout(() => setNotification(''), 3500);
                    }}
                  >
                    <RotateCcw size={14} className="mr-1.5" />
                    Reset to Boilerplate
                  </Button>
                </div>
              </div>
            )}
          </Panel>
        </section>

        {/* Live Preview Paper */}
        <Panel title="Quotation Live Preview">
          <div className="ws-quotation-paper" id="quotation-print-area">
            {/* Header */}
            <div className="ws-q-header">
              <h1 className="ws-q-title">QUOTATION</h1>
              <div className="ws-q-brand-badge">
                <svg
                  className="ws-q-logo-mark"
                  width="28"
                  height="22"
                  viewBox="0 0 32 28"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M4 22L14 6H19.5L9.5 22H4Z" fill="white" />
                  <path
                    d="M14 22L24 6H29L19 22H14Z"
                    fill="white"
                    opacity="0.9"
                  />
                </svg>
                <span className="ws-q-brand-name">
                  {form.agencyName || 'NOVERA LABS'}
                </span>
              </div>
            </div>

            {/* Quotation Details & Prepared For */}
            <div className="ws-q-meta-grid">
              <div className="ws-q-meta-col">
                <div className="ws-q-meta-heading">QUOTATION DETAILS</div>
                <div className="ws-q-meta-row">
                  <span className="ws-q-meta-label">Quotation No.:</span>
                  <span className="ws-q-meta-value">{form.quotationNo}</span>
                </div>
                <div className="ws-q-meta-row">
                  <span className="ws-q-meta-label">Date:</span>
                  <span className="ws-q-meta-value">{form.date}</span>
                </div>
              </div>
              <div className="ws-q-meta-col">
                <div className="ws-q-meta-heading">PREPARED FOR:</div>
                <div className="ws-q-meta-row underline-row">
                  <span className="ws-q-meta-label">Client Name</span>
                  <span className="ws-q-underline-val">{form.clientName}</span>
                </div>
                <div className="ws-q-meta-row underline-row">
                  <span className="ws-q-meta-label">Project Name</span>
                  <span className="ws-q-underline-val">{form.projectName}</span>
                </div>
              </div>
            </div>

            <div className="ws-q-divider" />

            {/* Deliverables summary */}
            <div className="ws-q-deliverables">
              <span className="ws-q-deliverables-title">Deliverables:</span>
              <span className="ws-q-deliverables-content">
                {form.deliverablesSummary}
              </span>
            </div>

            {/* Scope Container with polygon backdrop */}
            <div className="ws-q-scope-container">
              <div className="ws-q-scope-watermark" aria-hidden="true" />

              {/* Scope 1 */}
              <div className="ws-q-section">
                <div className="ws-q-section-title">{form.scope1Title}</div>
                {renderQuotationBullets(form.scope1Items)}
              </div>

              {/* Scope 2 */}
              <div className="ws-q-section">
                <div className="ws-q-section-title">{form.scope2Title}</div>
                {renderQuotationBullets(form.scope2Items)}
              </div>

              {/* Scope 3 */}
              <div className="ws-q-section">
                <div className="ws-q-section-title">{form.scope3Title}</div>
                {renderQuotationBullets(form.scope3Items)}
              </div>

              {/* Scope 4 */}
              <div className="ws-q-section">
                <div className="ws-q-section-title">{form.scope4Title}</div>
                {renderQuotationBullets(form.scope4Items)}
              </div>

              {/* Scope 5 */}
              <div className="ws-q-section">
                <div className="ws-q-section-title">{form.scope5Title}</div>
                {renderQuotationBullets(form.scope5Items)}
              </div>

              {/* Exclusions */}
              <div className="ws-q-section ws-q-exclusions">
                <div className="ws-q-section-title ws-q-exclusions-title">
                  Exclusions &amp; Third-Party Costs
                </div>
                {renderQuotationBullets(form.exclusions)}
              </div>
            </div>

            {/* Commercials / Total Project Value */}
            <div className="ws-q-commercials">
              <div className="ws-q-total-row">
                <span className="ws-q-total-label">Total Project Value :</span>
                <span className="ws-q-total-amount">
                  {form.totalProjectValue}
                </span>
              </div>
              <div className="ws-q-payment-terms">
                <span className="ws-q-payment-label">Payment Terms:</span>{' '}
                <strong>{form.paymentTerms}</strong>
              </div>
            </div>

            {/* Key Terms Banner */}
            <div className="ws-q-keyterms-banner">
              <div className="ws-q-keyterms-title">Key Terms</div>
              {renderQuotationBullets(form.keyTerms)}
            </div>

            {/* Footer Credit */}
            <div className="ws-q-footer">{form.footerText}</div>
          </div>

          <div className="ws-preview-actions">
            <Button
              type="button"
              className="ws-btn-primary w-full"
              onClick={() => window.print()}
            >
              <Printer size={15} className="mr-2" />
              Print / Save as PDF
            </Button>
          </div>
        </Panel>
      </div>
    </>
  );
}

function TeamView() {
  return <ResourceView resource="users" />;
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
  const { data, user, saveDocument, busy, refresh } = useCrm();
  const [tab, setTab] = useState('Workspace');
  const [saved, setSaved] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string>('');
  const [testBusy, setTestBusy] = useState(false);
  const current = (data.documents.settings?.value || {}) as { name?: string };
  const [name, setName] = useState(current.name || '');

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/webhooks/facebook`
      : 'https://your-crm-domain.com/api/webhooks/facebook';
  const verifyToken = 'novera_lead_secret_2026';

  const copyToClipboard = (text: string, key: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleSendTestLead = async () => {
    setTestBusy(true);
    setTestStatus('Sending test Facebook lead to CRM...');
    try {
      const res = await fetch('/api/webhooks/facebook/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Priya Sharma (Facebook Ad)',
          email: 'priya.sharma@example.com',
          phone: '+91 98201 54321',
          city: 'Mumbai',
          company: 'Sharma Healthcare',
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (res.ok) {
        setTestStatus('✅ Test lead received and saved to Leads Explorer!');
        await refresh();
      } else {
        setTestStatus(`❌ Error: ${json.error || 'Failed to trigger test lead.'}`);
      }
    } catch (err) {
      setTestStatus(
        `❌ Failed: ${err instanceof Error ? err.message : 'Network error'}`,
      );
    } finally {
      setTestBusy(false);
    }
  };

  return (
    <>
      <Heading title="Settings" />
      <Tabs
        items={['Workspace', 'Integrations', 'Notifications']}
        active={tab}
        onChange={setTab}
      />
      {tab === 'Integrations' ? (
        <div className="ws-integrations-container">
          <Panel title="Meta (Facebook & Instagram) Lead Ads Webhook">
            <div className="ws-meta-integration-card">
              <div className="ws-meta-status-banner">
                <div className="flex items-center gap-2">
                  <span className="ws-fin-dot green" />
                  <strong className="text-sm">Webhook Listener is Active</strong>
                </div>
                <span className="text-xs text-muted-foreground">
                  Ready to receive real-time leads from Facebook & Instagram Ad Forms
                </span>
              </div>

              <div className="ws-meta-fields-grid mt-4">
                <div className="ws-meta-field">
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Webhook Callback URL
                  </label>
                  <div className="ws-copy-input-wrap flex gap-2">
                    <Input readOnly value={webhookUrl} className="font-mono text-xs" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(webhookUrl, 'url')}
                    >
                      {copiedKey === 'url' ? (
                        <CheckCircle2 size={14} className="text-emerald-600" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="ws-meta-field mt-3">
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Verify Token
                  </label>
                  <div className="ws-copy-input-wrap flex gap-2">
                    <Input
                      readOnly
                      value={verifyToken}
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(verifyToken, 'token')}
                    >
                      {copiedKey === 'token' ? (
                        <CheckCircle2 size={14} className="text-emerald-600" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="ws-meta-test-box mt-5 p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Test Meta Ingestion Simulator
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Send a mock Facebook Lead Ad submission into your CRM to verify the pipeline.
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="ws-btn-primary"
                    disabled={testBusy}
                    onClick={handleSendTestLead}
                  >
                    <Sparkles size={14} className="mr-1.5" />
                    {testBusy ? 'Sending...' : '⚡ Send Test Facebook Lead'}
                  </Button>
                </div>
                {testStatus && (
                  <p className="text-xs mt-3 font-medium text-slate-700">
                    {testStatus}
                  </p>
                )}
              </div>

              <div className="ws-meta-guide mt-6 pt-5 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-900 mb-2">
                  How to link your Facebook Ad Account (3 Simple Steps):
                </h4>
                <ol className="text-xs text-slate-600 space-y-1.5 list-decimal pl-4">
                  <li>
                    Go to{' '}
                    <a
                      href="https://developers.facebook.com/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 underline font-medium inline-flex items-center gap-1"
                    >
                      Meta for Developers <ExternalLink size={11} />
                    </a>{' '}
                    and select your app.
                  </li>
                  <li>
                    Under <strong>Webhooks</strong>, select the <strong>Page</strong> object and click <strong>Subscribe to this object</strong>.
                  </li>
                  <li>
                    Paste the <strong>Callback URL</strong> and <strong>Verify Token</strong> from above, then subscribe to the <code>leadgen</code> field.
                  </li>
                </ol>
              </div>
            </div>
          </Panel>
        </div>
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
