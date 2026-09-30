'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Clock3, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import DraggableWidgetGrid, {
  type WidgetItem,
} from '@/components/ui/draggable-widget-grid';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

type DashboardWidgetKind =
  | 'leads'
  | 'clients'
  | 'projects'
  | 'team'
  | 'revenue'
  | 'expenses'
  | 'pipeline'
  | 'tasks';

export interface DashboardWidget extends WidgetItem {
  kind: DashboardWidgetKind;
}

export interface DashboardMetrics {
  leads: number;
  activeClients: number;
  ongoingProjects: number;
  teamMembers: number;
  paidThisMonth: number;
  expensesThisMonth: number;
  revenue: { month: string; amount: number; expenses: number }[];
  projectStatuses: { label: string; value: number }[];
  tasks: { id: number; title: string; dueDate: string }[];
}

const WIDGETS: DashboardWidget[] = [
  { id: 'leads', kind: 'leads', size: 'sm', label: 'Total leads' },
  { id: 'clients', kind: 'clients', size: 'sm', label: 'Active clients' },
  { id: 'projects', kind: 'projects', size: 'sm', label: 'Ongoing projects' },
  { id: 'team', kind: 'team', size: 'sm', label: 'Team members' },
  { id: 'revenue', kind: 'revenue', size: 'wide', label: 'Revenue overview' },
  { id: 'expenses', kind: 'expenses', size: 'sm', label: 'Monthly expenses' },
  { id: 'pipeline', kind: 'pipeline', size: 'sm', label: 'Project status' },
  { id: 'tasks', kind: 'tasks', size: 'wide', label: 'Upcoming tasks' },
];

const STORAGE_KEY = 'novera_dashboard_widget_order';
function initialWidgets() {
  if (typeof window === 'undefined') return WIDGETS;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[];
    if (!Array.isArray(saved) || !saved.length) return WIDGETS;
    const byId = new Map(WIDGETS.map((item) => [item.id, item]));
    const ordered = saved
      .map((id) => byId.get(id))
      .filter((item): item is DashboardWidget => Boolean(item));
    for (const item of WIDGETS) {
      if (!ordered.some((candidate) => candidate.id === item.id)) ordered.push(item);
    }
    return ordered;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return WIDGETS;
  }
}
const money = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

function Tile({
  title,
  children,
  meta,
}: {
  title: string;
  children: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <section className="flex h-full flex-col gap-3 p-5">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
          {title}
        </h3>
        {meta && <span className="text-[11px] text-slate-400">{meta}</span>}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

function Metric({ title, value, detail }: { title: string; value: ReactNode; detail: string }) {
  return (
    <Tile title={title} meta={<TrendingUp size={14} aria-hidden="true" />}>
      <strong className="text-[30px] leading-none font-bold tracking-tight text-slate-950">
        {value}
      </strong>
      <p className="mt-auto text-[12px] text-slate-500">{detail}</p>
    </Tile>
  );
}

function Revenue({ data }: { data: DashboardMetrics['revenue'] }) {
  const total = data.reduce((sum, point) => sum + point.amount, 0);
  return (
    <Tile title="Revenue overview" meta="Last 6 months">
      <strong className="text-[28px] leading-none font-bold tracking-tight text-slate-950">
        {money(total)}
      </strong>
      <ChartContainer
        className="mt-auto h-[145px] w-full text-[10px]"
        config={{
          amount: { label: 'Collected revenue', color: '#6366f1' },
          expenses: { label: 'Expenses', color: '#f43f5e' },
        }}
      >
        <AreaChart data={data} margin={{ top: 12, right: 4, bottom: 0, left: -22 }}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(value) => `$${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area dataKey="amount" stroke="#6366f1" fill="#c7d2fe" fillOpacity={0.65} isAnimationActive={false} />
          <Area dataKey="expenses" stroke="#f43f5e" fill="#ffe4e6" fillOpacity={0.5} isAnimationActive={false} />
        </AreaChart>
      </ChartContainer>
    </Tile>
  );
}

function Pipeline({ rows }: { rows: DashboardMetrics['projectStatuses'] }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <Tile title="Project status" meta={`${total} total`}>
      <div className="mt-1 flex flex-1 flex-col justify-center gap-3">
        {rows.map((row, index) => (
          <div key={row.label} className="flex items-center gap-2 text-[12px]">
            <span
              className={`size-2 rounded-full ${
                ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-slate-300'][index]
              }`}
            />
            <span className="truncate text-slate-600">{row.label}</span>
            <strong className="ml-auto text-slate-950 tabular-nums">{row.value}</strong>
          </div>
        ))}
      </div>
    </Tile>
  );
}

function Tasks({
  tasks,
  onOpen,
}: {
  tasks: DashboardMetrics['tasks'];
  onOpen: () => void;
}) {
  return (
    <Tile title="Tasks due next" meta="7 days">
      <div className="mt-auto divide-y divide-slate-100">
        {tasks.slice(0, 4).map((task) => (
          <button
            type="button"
            key={task.id}
            onClick={onOpen}
            className="flex w-full items-center gap-3 py-2.5 text-left text-[12px] text-slate-700 hover:text-indigo-600"
          >
            <Clock3 size={14} className="shrink-0 text-indigo-500" />
            <span className="truncate">{task.title}</span>
            <time className="ml-auto shrink-0 text-slate-400">{task.dueDate}</time>
          </button>
        ))}
        {!tasks.length && (
          <p className="py-6 text-center text-[12px] text-slate-400">No tasks due this week.</p>
        )}
      </div>
    </Tile>
  );
}

export default function DraggableWidgetGridDemo({
  metrics,
  onNavigate,
}: {
  metrics: DashboardMetrics;
  onNavigate: (value: string) => void;
}) {
  const [items, setItems] = useState<DashboardWidget[]>(initialWidgets);

  const views = useMemo<Record<DashboardWidgetKind, ReactNode>>(
    () => ({
      leads: <Metric title="Total leads" value={metrics.leads} detail="Across your sales pipeline" />,
      clients: <Metric title="Active clients" value={metrics.activeClients} detail="Currently engaged accounts" />,
      projects: <Metric title="Ongoing projects" value={metrics.ongoingProjects} detail="Work currently in progress" />,
      team: <Metric title="Team members" value={metrics.teamMembers} detail="Active workspace users" />,
      revenue: <Revenue data={metrics.revenue} />,
      expenses: <Metric title="Monthly expenses" value={money(metrics.expensesThisMonth)} detail={`${money(metrics.paidThisMonth)} collected this month`} />,
      pipeline: <Pipeline rows={metrics.projectStatuses} />,
      tasks: <Tasks tasks={metrics.tasks} onOpen={() => onNavigate('Tasks')} />,
    }),
    [metrics, onNavigate],
  );

  return (
    <DraggableWidgetGrid
      items={items}
      maxColumns={4}
      cellSize={240}
      gap={14}
      radius={16}
      className="ws-draggable-dashboard"
      onChange={(next) => {
        const ordered = next as DashboardWidget[];
        setItems(ordered);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ordered.map((item) => item.id)));
      }}
      renderItem={(item) => views[(item as DashboardWidget).kind]}
    />
  );
}