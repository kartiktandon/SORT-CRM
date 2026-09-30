'use client';

import { useState, type CSSProperties } from 'react';
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Crown,
  Download,
  Eye,
  FileText,
  Globe,
  Camera,
  LayoutGrid,
  List,
  Heart,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  PhoneCall,
  Plus,
  Search,
  SlidersHorizontal,
  Target,
  Trash2,
  Trophy,
  UserRound,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import './leads.css';
import { useCrm, useRecords, text, dateLabel } from './crm-data';
const toStatus = (stage: string) =>
  ({ New: 'New leads', Won: 'Closed', 'Proposal Sent': 'Proposal' })[stage] ||
  stage;
const toStage = (status: string) =>
  ({ 'New leads': 'New', Closed: 'Won', Proposal: 'Proposal Sent' })[status] ||
  status;

type SeedLead = {
  name: string;
  company: string;
  stage: string;
  source: string;
  age: string;
  temperature: string;
};
type Lead = SeedLead & {
  id: number;
  platform: string;
  phone: string;
  email: string;
  city: string;
  budget: string;
  service: string;
  timeline: string;
  owner: string;
  followUp: string;
  followUpDate: string;
  notes: string;
  createdAt: string;
};
type LeadNote = {
  id: number;
  leadId: number;
  userName: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};
const legacyBudgetFromNotes = (notes: string) => {
  const match = notes.match(
    /(?:^|[|·])\s*what_is_your_estimated_project_budget\??:\s*([^|·]+)/i,
  );
  if (!match) return '';
  const value = match[1].replaceAll('_', ' ').trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
};
const legacyServiceFromNotes = (notes: string) => {
  const match = notes.match(
    /(?:^|[|·])\s*what_do_you_want_to_build\??:\s*([^|·]+)/i,
  );
  if (!match) return '';
  const service = match[1].replaceAll('_', ' ').trim();
  return service ? service.charAt(0).toUpperCase() + service.slice(1) : '';
};
const noteDateTime = (value: string) => {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Time unavailable';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
const stageNames = [
  'New',
  'Contacted',
  'Interested',
  'Proposal Sent',
  'Ringing',
  'Won',
  'Lost',
];
const stageColors: Record<string, string> = {
  New: '#818cf8',
  Contacted: '#d99b1c',
  Interested: '#f07836',
  'Proposal Sent': '#9865df',
  Ringing: '#c48c1c',
  Won: '#21a978',
  Lost: '#6486ac',
};
const platforms = ['Facebook', 'Instagram', 'Website'];
const emptyLead: Lead = {
  id: 0,
  name: '',
  company: '',
  stage: 'New',
  source: 'Website',
  platform: 'Website',
  age: 'Just now',
  temperature: '',
  phone: '',
  email: '',
  city: '',
  budget: '',
  service: '',
  timeline: '',
  owner: '',
  followUp: 'No follow-up',
  followUpDate: '',
  notes: '',
  createdAt: '',
};

type DateRange = 'All Dates' | 'Today' | 'Last 7 Days' | 'Last 30 Days' | 'This Month';

const leadDate = (lead: Lead) => {
  const value = new Date(lead.createdAt);
  return Number.isFinite(value.getTime()) ? value : null;
};

const isInDateRange = (lead: Lead, range: DateRange) => {
  if (range === 'All Dates') return true;
  const date = leadDate(lead);
  if (!date) return false;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'Today') return date >= startToday;
  if (range === 'This Month') {
    return date >= new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const days = range === 'Last 7 Days' ? 7 : 30;
  const start = new Date(startToday);
  start.setDate(start.getDate() - (days - 1));
  return date >= start;
};
function tone(stage: string) {
  return stage === 'Proposal Sent' ? 'proposal' : stage.toLowerCase();
}
function exportLeads(leads: Lead[]) {
  const keys = [
    'name',
    'company',
    'phone',
    'email',
    'city',
    'platform',
    'stage',
    'budget',
    'owner',
    'followUp',
    'followUpDate',
  ] as const;
  const escape = (value: string) =>
    `"${(/^[=+@-]/.test(value) ? "'" : '') + value.replaceAll('"', '""')}"`;
  const csv = [
    keys.join(','),
    ...leads.map((lead) => keys.map((key) => escape(lead[key])).join(',')),
  ].join('\r\n');
  const url = URL.createObjectURL(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'crm-leads.csv';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function LeadsExplorer() {
  const { user, save, remove, busy } = useCrm();
  const records = useRecords('leads');
  const noteRecords = useRecords('lead_notes');
  const owners = useRecords('users').map((row) => text(row, 'name'));
  const leadNotes: LeadNote[] = noteRecords.map((row) => ({
    id: row.id,
    leadId: Number(row.lead_id),
    userName: text(row, 'user_name') || 'Unknown user',
    note: text(row, 'note'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  }));
  const leads: Lead[] = records.map((row) => ({
    id: row.id,
    name: text(row, 'name'),
    company: text(row, 'company'),
    stage: toStage(text(row, 'status')),
    source: text(row, 'source'),
    age: dateLabel(row.created_at),
    temperature: text(row, 'temperature'),
    platform: text(row, 'platform') || 'Website',
    phone: text(row, 'phone'),
    email: text(row, 'email'),
    city: text(row, 'city'),
    budget: text(row, 'budget'),
    service:
      text(row, 'service') || legacyServiceFromNotes(text(row, 'notes')),
    timeline: text(row, 'timeline'),
    owner: text(row, 'owner'),
    followUp: text(row, 'follow_up') || 'No follow-up',
    followUpDate: text(row, 'follow_up_date').slice(0, 10),
    notes: text(row, 'notes'),
    createdAt: text(row, 'created_at'),
  }));
  const saveLead = async (lead: Lead, newNote: string) => {
    const savedLead = await save('leads', {
      ...(lead.id ? { id: lead.id } : {}),
      name: lead.name,
      company: lead.company,
      status: toStatus(lead.stage),
      source: lead.source,
      temperature: lead.temperature,
      platform: lead.platform,
      phone: lead.phone,
      email: lead.email,
      city: lead.city,
      budget: lead.budget || legacyBudgetFromNotes(lead.notes || ''),
      service: lead.service || legacyServiceFromNotes(lead.notes || ''),
      timeline: lead.timeline,
      owner: lead.owner,
      follow_up: lead.followUp,
      follow_up_date: lead.followUpDate,
      ...(lead.id ? {} : { notes: '' }),
    });
    if (newNote.trim()) {
      await save('lead_notes', { lead_id: savedLead.id, note: newNote.trim() });
    }
  };
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('All Platforms');
  const [stage, setStage] = useState('All Stages');
  const [followUp, setFollowUp] = useState('Follow-ups');
  const [owner, setOwner] = useState('All Owners');
  const [city, setCity] = useState('All Cities');
  const [priority, setPriority] = useState('All Priorities');
  const [company, setCompany] = useState('All Companies');
  const [dateRange, setDateRange] = useState<DateRange>('All Dates');
  const [quickFilter, setQuickFilter] = useState<'All' | 'Follow Up' | 'Call Back'>('All');
  const [filters, setFilters] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [view, setView] = useState('Cards');
  const [newest, setNewest] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [draft, setDraft] = useState<Lead | null>(null);
  const [detailTab, setDetailTab] = useState('Overview');
  const [newNote, setNewNote] = useState('');
  const [notice, setNotice] = useState('');
  const [bulkStage, setBulkStage] = useState('New');
  const [scope, setScope] = useState('All Leads');
  const companies = Array.from(
    new Set(leads.map((lead) => lead.company).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const metricScopedLeads = leads.filter(
    (lead) =>
      isInDateRange(lead, dateRange) &&
      (company === 'All Companies' || lead.company === company),
  );
  const filtered = leads
    .filter(
      (lead) =>
        Object.values(lead)
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (platform === 'All Platforms' || lead.platform === platform) &&
        (stage === 'All Stages' || lead.stage === stage) &&
        (followUp === 'Follow-ups' || lead.followUp === followUp) &&
        (owner === 'All Owners' ||
          (owner === 'Unassigned' ? !lead.owner : lead.owner === owner)) &&
        (city === 'All Cities' || lead.city === city) &&
        (priority === 'All Priorities' || lead.temperature === priority) &&
        (company === 'All Companies' || lead.company === company) &&
        isInDateRange(lead, dateRange) &&
        (quickFilter === 'All' ||
          (quickFilter === 'Follow Up'
            ? lead.followUp !== 'No follow-up' || Boolean(lead.followUpDate)
            : lead.followUp === 'Due Today' ||
              lead.followUp === 'Overdue' ||
              lead.stage === 'Ringing')) &&
        (scope === 'All Leads' || lead.owner === user.name),
    )
    .sort((a, b) => {
      const aTime = leadDate(a)?.getTime() || a.id;
      const bTime = leadDate(b)?.getTime() || b.id;
      return newest ? bTime - aTime : aTime - bTime;
    });
  const totalPages = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * 12, currentPage * 12);
  const reset = () => {
    setQuery('');
    setPlatform('All Platforms');
    setStage('All Stages');
    setFollowUp('Follow-ups');
    setOwner('All Owners');
    setCity('All Cities');
    setPriority('All Priorities');
    setCompany('All Companies');
    setDateRange('All Dates');
    setQuickFilter('All');
    setScope('All Leads');
    setPage(1);
  };
  const toggleSelected = (id: number) =>
    setSelected(
      selected.includes(id)
        ? selected.filter((value) => value !== id)
        : [...selected, id],
    );
  const deleteLead = async (lead: Lead) => {
    if (!lead.id) return;
    const ok = window.confirm(`Are you sure you want to delete lead "${lead.name}"?`);
    if (!ok) return;
    try {
      await remove('leads', lead.id);
      setSelected((prev) => prev.filter((id) => id !== lead.id));
      if (draft?.id === lead.id) setDraft(null);
      setNotice(`Lead "${lead.name}" has been deleted.`);
    } catch {
      setNotice('Failed to delete lead. Please try again.');
    }
  };
  const deleteSelected = async () => {
    if (!selected.length) return;
    const ok = window.confirm(
      `Are you sure you want to delete ${selected.length} selected lead(s)?`,
    );
    if (!ok) return;
    try {
      for (const id of selected) {
        await remove('leads', id);
      }
      setSelected([]);
      setNotice(`${selected.length} lead(s) deleted.`);
    } catch {
      setNotice('Failed to delete some leads. Please try again.');
    }
  };
  const openLead = (lead: Lead, tab = 'Overview') => {
    setDraft({ ...lead });
    setNewNote('');
    setDetailTab(tab);
  };
  const count = (predicate: (lead: Lead) => boolean) =>
    metricScopedLeads.filter(predicate).length;
  const filterCount = [
    platform !== 'All Platforms',
    stage !== 'All Stages',
    followUp !== 'Follow-ups',
    owner !== 'All Owners',
    city !== 'All Cities',
    priority !== 'All Priorities',
    company !== 'All Companies',
    dateRange !== 'All Dates',
    quickFilter !== 'All',
  ].filter(Boolean).length;
  const applyStage = async () => {
    let updated = 0;
    try {
      for (const id of selected) {
        await save('leads', { id, status: toStatus(bulkStage) });
        updated++;
      }
      setNotice(`${updated} leads moved to ${bulkStage}.`);
      setSelected([]);
    } catch {
      setNotice(
        `${updated} leads updated before the request failed. Remaining changes were not saved.`,
      );
    }
  };
  const platformMark = (value: string) =>
    value === 'Instagram' ? (
      <Camera size={11} />
    ) : value === 'Website' ? (
      <Globe size={11} />
    ) : (
      <span aria-hidden="true">f</span>
    );
  const stageBadge = (lead: Lead) => {
    const color = stageColors[lead.stage] || '#6366f1';
    return (
      <span
        className="lx-stage"
        style={{
          backgroundColor: `${color}18`,
          color: color,
          borderColor: `${color}38`,
        }}
      >
        <span className="lx-stage-dot" style={{ backgroundColor: color }} />
        {lead.stage}
      </span>
    );
  };
  const metricCards = [
    {
      label: 'Total Leads',
      value: metricScopedLeads.length,
      icon: UserRound,
      tone: 'purple',
      selected: stage === 'All Stages' && followUp === 'Follow-ups',
      action: reset,
    },
    {
      label: "Today's Leads",
      value: count((lead) => isInDateRange(lead, 'Today')),
      icon: CalendarDays,
      tone: 'blue',
      action: () => {
        setQuickFilter('All');
        setDateRange('Today');
        setPage(1);
      },
    },
    {
      label: 'New Leads',
      value: count((lead) => lead.stage === 'New'),
      icon: Plus,
      tone: 'orange',
      selected: stage === 'New',
      action: () => {
        setQuickFilter('All');
        setStage('New');
        setPage(1);
      },
    },
    {
      label: 'Follow Up',
      value: count(
        (lead) =>
          lead.followUp !== 'No follow-up' || Boolean(lead.followUpDate),
      ),
      icon: Clock3,
      tone: 'green',
      selected: quickFilter === 'Follow Up',
      action: () => {
        setQuickFilter('Follow Up');
        setPage(1);
      },
    },
    {
      label: 'Call Back',
      value: count(
        (lead) =>
          lead.followUp === 'Due Today' ||
          lead.followUp === 'Overdue' ||
          lead.stage === 'Ringing',
      ),
      icon: PhoneCall,
      tone: 'teal',
      selected: quickFilter === 'Call Back',
      action: () => {
        setQuickFilter('Call Back');
        setPage(1);
      },
    },
    {
      label: 'Interested',
      value: count((lead) => lead.stage === 'Interested'),
      icon: Heart,
      tone: 'red',
      selected: stage === 'Interested',
      action: () => {
        setQuickFilter('All');
        setStage('Interested');
        setPage(1);
      },
    },
    {
      label: 'Packages Sent',
      value: count((lead) => lead.stage === 'Proposal Sent'),
      icon: Package,
      tone: 'sky',
      selected: stage === 'Proposal Sent',
      action: () => {
        setQuickFilter('All');
        setStage('Proposal Sent');
        setPage(1);
      },
    },
    {
      label: 'Closed / Won',
      value: count((lead) => lead.stage === 'Won'),
      icon: Crown,
      tone: 'violet',
      selected: stage === 'Won',
      action: () => {
        setQuickFilter('All');
        setStage('Won');
        setPage(1);
      },
    },
  ];
  const select = (
    label: string,
    value: string,
    options: string[],
    change: (value: string) => void,
  ) => (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => {
        change(e.target.value);
        setPage(1);
      }}
    >
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  );
  const formSelect = (
    label: string,
    value: string,
    options: string[],
    change: (value: string) => void,
  ) => (
    <select
      className="lx-field-select"
      aria-label={label}
      value={value}
      onChange={(e) => change(e.target.value)}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
  return (
    <section className="lx-leads">
      <div className="lx-reference-toolbar">
        <label>
          <span>Company</span>
          <select
            aria-label="Filter leads by company"
            value={company}
            onChange={(event) => {
              setCompany(event.target.value);
              setPage(1);
            }}
          >
            <option>All Companies</option>
            {companies.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="lx-welcome">
        <div>
          <strong>👋 Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user.name}!</strong>
          <p>Let&apos;s turn every lead into an unforgettable celebration.</p>
        </div>
        <select
          aria-label="Filter leads by creation date"
          value={dateRange}
          onChange={(event) => {
            setDateRange(event.target.value as DateRange);
            setPage(1);
          }}
        >
          {['All Dates', 'Today', 'Last 7 Days', 'Last 30 Days', 'This Month'].map(
            (item) => (
              <option key={item}>{item}</option>
            ),
          )}
        </select>
      </div>
      <div className="lx-metrics" aria-label="Lead status overview">
        {metricCards.map(({ label, value, icon: Icon, tone, selected: active, action }) => (
          <button
            type="button"
            key={label}
            className={`lx-metric lx-metric-${tone} ${active ? 'active' : ''}`}
            onClick={action}
          >
            <span className="lx-metric-icon"><Icon size={25} /></span>
            <span className="lx-metric-copy">
              <strong>{value}</strong>
              <small>{label}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="lx-heading">
        <div>
          <h3>Leads</h3>
          <p>Every opportunity. One clear view.</p>
        </div>
        <div className="lx-heading-actions">
          <Button
            className="ws-button"
            onClick={() => {
              setDraft({ ...emptyLead });
              setNewNote('');
              setDetailTab('Overview');
            }}
          >
            <UserPlus size={14} />
            Add Lead
          </Button>
          <button
            className="lx-icon-button"
            aria-label="Export leads as CSV"
            title="Export CSV"
            onClick={() =>
              exportLeads(
                selected.length
                  ? leads.filter((lead) => selected.includes(lead.id))
                  : filtered,
              )
            }
          >
            <Download size={15} />
          </button>
          <button
            className={`lx-icon-button ${analytics ? 'active' : ''}`}
            aria-label="Toggle lead analytics"
            aria-pressed={analytics}
            title="Analytics"
            onClick={() => setAnalytics(!analytics)}
          >
            <BarChart3 size={15} />
          </button>
        </div>
      </div>
      <div className="lx-summary lx-summary-secondary" aria-label="Lead summary filters">
        <button className="indigo" onClick={reset}>
          <Users size={12} />
          {leads.length} leads
        </button>
        <button
          className="amber"
          onClick={() => {
            setFollowUp('Due Today');
            setPage(1);
          }}
        >
          <Clock3 size={12} />
          {count((lead) => lead.followUp === 'Due Today')} due today
        </button>
        <button
          className="red"
          onClick={() => {
            setFollowUp('Overdue');
            setPage(1);
          }}
        >
          <CalendarClock size={12} />
          {count((lead) => lead.followUp === 'Overdue')} overdue
        </button>
        <button
          className="violet"
          onClick={() => {
            setFollowUp('Upcoming (7d)');
            setPage(1);
          }}
        >
          {count((lead) => lead.followUp === 'Upcoming (7d)')} upcoming
        </button>
        <button
          className="orange"
          onClick={() => {
            setOwner('Unassigned');
            setPage(1);
          }}
        >
          {count((lead) => !lead.owner)} unassigned
        </button>
        <button
          className="green"
          onClick={() => {
            setStage('Won');
            setPage(1);
          }}
        >
          <Trophy size={12} />
          {count((lead) => lead.stage === 'Won')} won
        </button>
        <button className="cyan" onClick={() => setAnalytics(!analytics)}>
          {Math.round(
            (count((lead) => lead.stage === 'Won') /
              Math.max(1, leads.length)) *
              100,
          )}
          % conv
        </button>
        {platforms.map((item) => (
          <button
            key={item}
            className={
              item === 'Facebook'
                ? 'indigo'
                : item === 'Instagram'
                  ? 'violet'
                  : 'green'
            }
            aria-label={`Filter ${item} leads`}
            onClick={() => {
              setPlatform(platform === item ? 'All Platforms' : item);
              setPage(1);
            }}
          >
            {platformMark(item)}
            {count((lead) => lead.platform === item)}
          </button>
        ))}
        <button
          className="lx-ringing"
          onClick={() => {
            const candidates = leads.filter((lead) => lead.stage === 'Ringing');
            if (candidates.length) {
              openLead(
                candidates[Math.floor(Math.random() * candidates.length)],
              );
              setNotice('Ringing of the Day: a lead to follow up with next.');
            } else setNotice('No ringing leads at the moment.');
          }}
        >
          <Crown size={12} />
          Ringing of the Day
        </button>
      </div>
      {analytics && (
        <div className="lx-analytics">
          <article>
            <h4>
              <Target size={14} />
              Stage Pipeline
            </h4>
            {stageNames.map((item) => (
              <button
                key={item}
                onClick={() => {
                  setStage(item);
                  setPage(1);
                }}
              >
                <span>{item}</span>
                <div>
                  <i
                    style={{
                      width: `${(count((lead) => lead.stage === item) / Math.max(1, leads.length)) * 100}%`,
                      background: stageColors[item],
                    }}
                  />
                </div>
                <b>{count((lead) => lead.stage === item)}</b>
              </button>
            ))}
          </article>
          <article>
            <h4>
              <BarChart3 size={14} />
              Lead Sources
            </h4>
            {platforms.map((item) => (
              <button
                key={item}
                onClick={() => {
                  setPlatform(item);
                  setPage(1);
                }}
              >
                <span>{item}</span>
                <div>
                  <i
                    style={{
                      width: `${(count((lead) => lead.platform === item) / Math.max(1, leads.length)) * 100}%`,
                      background:
                        item === 'Instagram'
                          ? '#b46de5'
                          : item === 'Website'
                            ? '#38bfa1'
                            : '#6c7df2',
                    }}
                  />
                </div>
                <b>{count((lead) => lead.platform === item)}</b>
              </button>
            ))}
            <p>
              {count((lead) => lead.stage === 'Won')} opportunities won out of{' '}
              {leads.length} leads.
            </p>
          </article>
        </div>
      )}
      <div className="lx-filter-panel">
        <div className="lx-filter-row">
          <label className="lx-search" htmlFor="leads-search">
            <Search size={15} />
            <Input
              id="leads-search"
              placeholder="Search leads..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>
          {select(
            'Platform',
            platform,
            ['All Platforms', ...platforms],
            setPlatform,
          )}
          {select('Stage', stage, ['All Stages', ...stageNames], setStage)}
          {select(
            'Follow-up',
            followUp,
            [
              'Follow-ups',
              'Due Today',
              'Overdue',
              'Upcoming (7d)',
              'No follow-up',
            ],
            setFollowUp,
          )}
          <button
            className={`lx-filter-button ${filters ? 'active' : ''}`}
            onClick={() => setFilters(!filters)}
            aria-expanded={filters}
          >
            <SlidersHorizontal size={14} />
            Filters{filterCount > 0 && <b>{filterCount}</b>}
          </button>
          <button
            className="lx-filter-button"
            onClick={() => {
              setNewest(!newest);
              setPage(1);
            }}
          >
            {newest ? '↓ Newest' : '↑ Oldest'}
          </button>
          <div className="lx-view-switch">
            <button
              aria-label="Card view"
              aria-pressed={view === 'Cards'}
              className={view === 'Cards' ? 'active' : ''}
              onClick={() => setView('Cards')}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              aria-label="Table view"
              aria-pressed={view === 'Table'}
              className={view === 'Table' ? 'active' : ''}
              onClick={() => setView('Table')}
            >
              <List size={15} />
            </button>
          </div>
        </div>
        {filters && (
          <div className="lx-extra-filters">
            <div>
              <span>Owner</span>
              {select(
                'Owner',
                owner,
                [
                  'All Owners',
                  'Unassigned',
                  ...Array.from(
                    new Set([
                      ...owners,
                      ...leads.map((lead) => lead.owner).filter(Boolean),
                    ]),
                  ),
                ],
                setOwner,
              )}
            </div>
            <div>
              <span>City</span>
              {select(
                'City',
                city,
                [
                  'All Cities',
                  ...Array.from(
                    new Set(leads.map((lead) => lead.city).filter(Boolean)),
                  ),
                ],
                setCity,
              )}
            </div>
            <div>
              <span>Priority</span>
              {select(
                'Priority',
                priority,
                ['All Priorities', 'Hot', 'Warm', 'Won', 'Lost'],
                setPriority,
              )}
            </div>
            <button className="ws-link" onClick={reset}>
              Clear all filters
            </button>
          </div>
        )}
      </div>
      <div className="lx-results-bar">
        <div className="lx-scope">
          {['All Leads', 'My Leads'].map((item) => (
            <button
              key={item}
              className={scope === item ? 'active' : ''}
              aria-pressed={scope === item}
              onClick={() => {
                setScope(item);
                setPage(1);
              }}
            >
              {item}
            </button>
          ))}
        </div>
        <span>
          {filtered.length} results
          {(filterCount > 0 || query) && (
            <button onClick={reset}>
              Clear filters
              <X size={11} />
            </button>
          )}
        </span>
      </div>
      {notice && (
        <output className="lx-notice">
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <X size={14} />
          </button>
        </output>
      )}
      {selected.length > 0 && (
        <div className="lx-bulk">
          <strong>{selected.length} selected</strong>
          {select('Bulk stage', bulkStage, stageNames, setBulkStage)}
          <button
            disabled={busy}
            onClick={() => {
              void applyStage();
            }}
          >
            Update stage
          </button>
          <button
            onClick={() =>
              exportLeads(leads.filter((lead) => selected.includes(lead.id)))
            }
          >
            Export selected
          </button>
          <button
            className="lx-bulk-delete"
            disabled={busy}
            onClick={() => void deleteSelected()}
          >
            <Trash2 size={12} />
            Delete selected
          </button>
          <button onClick={() => setSelected([])}>Clear selection</button>
        </div>
      )}
      {view === 'Cards' ? (
        <div className="lx-grid">
          {visible.map((lead) => (
            <article
              key={lead.id}
              className={`lx-card lx-${tone(lead.stage)} ${selected.includes(lead.id) ? 'is-selected' : ''}`}
              style={
                { '--lead-accent': stageColors[lead.stage] } as CSSProperties
              }
            >
              <div className="lx-card-strip" />
              <div className="lx-card-body">
                <header>
                  <button
                    className={`lx-avatar platform-${lead.platform.toLowerCase()}`}
                    onClick={() => openLead(lead)}
                    aria-label={`View ${lead.name}`}
                  >
                    {lead.name[0]}
                  </button>
                  <div>
                    <button className="lx-name" onClick={() => openLead(lead)}>
                      {lead.name}
                    </button>
                    <div className="lx-card-badges">
                      {stageBadge(lead)}
                      <span
                        className={`lx-platform platform-${lead.platform.toLowerCase()}`}
                      >
                        {platformMark(lead.platform)}
                        {lead.platform}
                      </span>
                      {lead.temperature === 'Hot' && (
                        <span className="lx-tag-priority priority-hot">Hot</span>
                      )}
                      {lead.temperature === 'Warm' && (
                        <span className="lx-tag-priority priority-warm">Warm</span>
                      )}
                      {lead.temperature === 'Cold' && (
                        <span className="lx-tag-priority priority-cold">Cold</span>
                      )}
                      {lead.followUp === 'Overdue' && (
                        <span className="lx-tag-overdue">Overdue</span>
                      )}
                    </div>
                  </div>
                  <div className="lx-card-select">
                    <input
                      type="checkbox"
                      checked={selected.includes(lead.id)}
                      onChange={() => toggleSelected(lead.id)}
                      aria-label={`Select ${lead.name}`}
                    />
                  </div>
                </header>
                <dl className="lx-card-details">
                  <div>
                    <dt>Company / Brand</dt>
                    <dd>{lead.company || 'Not added'}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>
                      <Phone size={12} />
                      {lead.phone || 'Not added'}
                    </dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>
                      <Mail size={12} />
                      {lead.email || 'Not added'}
                    </dd>
                  </div>
                  <div>
                    <dt>City / Location</dt>
                    <dd>
                      <MapPin size={12} />
                      {lead.city || 'Not added'}
                    </dd>
                  </div>
                  <div>
                    <dt>Budget</dt>
                    <dd>{lead.budget || 'Not added'}</dd>
                  </div>
                  <div>
                    <dt>Interested Service</dt>
                    <dd>
                      <Briefcase size={12} />
                      {lead.service || 'Not added'}
                    </dd>
                  </div>
                  <div>
                    <dt>Project Timeline</dt>
                    <dd>
                      <CalendarClock size={12} />
                      {lead.timeline || 'Not added'}
                    </dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{lead.platform}</dd>
                  </div>
                  <div>
                    <dt>Stage</dt>
                    <dd>{lead.stage}</dd>
                  </div>
                  <div>
                    <dt>Follow-up</dt>
                    <dd>
                      <CalendarClock size={12} />
                      {lead.followUpDate
                        ? dateLabel(lead.followUpDate)
                        : lead.followUp}
                    </dd>
                  </div>
                </dl>
                <div className="lx-card-actions">
                  {lead.phone ? (
                    <a href={`tel:${lead.phone.replace(/[^+\d]/g, '')}`}>
                      <Phone size={12} />
                      Call
                    </a>
                  ) : (
                    <button onClick={() => openLead(lead, 'Contact')}>
                      <Phone size={12} />
                      Call
                    </button>
                  )}
                  {lead.phone ? (
                    <a
                      href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageSquare size={12} />
                      WhatsApp
                    </a>
                  ) : (
                    <button onClick={() => openLead(lead, 'Contact')}>
                      <MessageSquare size={12} />
                      WhatsApp
                    </button>
                  )}
                  <button onClick={() => openLead(lead)}>
                    <Eye size={12} />
                    Details
                  </button>
                  <button
                    className="lx-card-delete"
                    title={`Delete ${lead.name}`}
                    aria-label={`Delete ${lead.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteLead(lead);
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="lx-table">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    aria-label="Select visible leads"
                    type="checkbox"
                    checked={
                      visible.length > 0 &&
                      visible.every((lead) => selected.includes(lead.id))
                    }
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? Array.from(
                              new Set([
                                ...selected,
                                ...visible.map((lead) => lead.id),
                              ]),
                            )
                          : selected.filter(
                              (id) => !visible.some((lead) => lead.id === id),
                            ),
                      )
                    }
                  />
                </th>
                {[
                  'Date',
                  'Contact',
                  'City',
                  'Platform',
                  'Campaign',
                  'Budget',
                  'Service',
                  'Timeline',
                  'Stage',
                  'Owner',
                  'Follow-up',
                  'Follow-up Date',
                  'Actions',
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(lead.id)}
                      onChange={() => toggleSelected(lead.id)}
                      aria-label={`Select ${lead.name}`}
                    />
                  </td>
                  <td>{lead.age}</td>
                  <td>
                    <button
                      className="lx-table-name"
                      onClick={() => openLead(lead)}
                    >
                      {lead.name}
                    </button>
                    <small>{lead.phone || 'No phone added'}</small>
                  </td>
                  <td>{lead.city || '—'}</td>
                  <td>
                    <span
                      className={`lx-platform platform-${lead.platform.toLowerCase()}`}
                    >
                      {platformMark(lead.platform)}
                      {lead.platform}
                    </span>
                  </td>
                  <td>{lead.company}</td>
                  <td>{lead.budget || '—'}</td>
                  <td>{lead.service || '—'}</td>
                  <td>{lead.timeline || '—'}</td>
                  <td>{stageBadge(lead)}</td>
                  <td>{lead.owner || 'Unassigned'}</td>
                  <td>{lead.followUp}</td>
                  <td>{dateLabel(lead.followUpDate)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        className="lx-icon-button"
                        aria-label={`Details for ${lead.name}`}
                        title="View Details"
                        onClick={() => openLead(lead)}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        className="lx-icon-button lx-btn-delete-icon"
                        aria-label={`Delete ${lead.name}`}
                        title="Delete Lead"
                        onClick={() => void deleteLead(lead)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!filtered.length && (
        <div className="lx-empty">
          <Target size={35} />
          <h4>No leads found</h4>
          <p>Try adjusting your search or filters.</p>
          <button onClick={reset}>Reset filters</button>
        </div>
      )}
      <div className="lx-pagination">
        <span>
          Page {currentPage} of {totalPages} · {filtered.length} leads
        </span>
        <div>
          <button
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft size={14} />
            Previous
          </button>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
      >
        <DialogContent className="ws-dialog lx-dialog">
          {draft && (
            <>
              <div className="lx-dialog-header">
                <div
                  className="lx-dialog-avatar"
                  style={
                    draft.stage && stageColors[draft.stage]
                      ? {
                          background: `linear-gradient(135deg, ${stageColors[draft.stage]}, #4f46e5)`,
                        }
                      : undefined
                  }
                >
                  {draft.name ? draft.name[0]?.toUpperCase() : '+'}
                </div>
                <div className="lx-dialog-title-block">
                  <DialogTitle className="lx-dialog-title">
                    {draft.id ? draft.name : 'Add Lead Manually'}
                  </DialogTitle>
                  <DialogDescription className="lx-dialog-description">
                    {draft.id ? (
                      <span className="lx-dialog-meta">
                        <span
                          className="lx-badge-stage"
                          style={{
                            backgroundColor: `${stageColors[draft.stage]}20`,
                            color: stageColors[draft.stage],
                            borderColor: `${stageColors[draft.stage]}40`,
                          }}
                        >
                          {draft.stage}
                        </span>
                        <span>·</span>
                        <span>{draft.platform}</span>
                        {draft.company && (
                          <>
                            <span>·</span>
                            <span>{draft.company}</span>
                          </>
                        )}
                        {draft.temperature && (
                          <>
                            <span>·</span>
                            <span className="lx-hot">{draft.temperature}</span>
                          </>
                        )}
                      </span>
                    ) : (
                      'Add a new opportunity to your lead workspace.'
                    )}
                  </DialogDescription>
                </div>
              </div>

              <div className="lx-dialog-tabs">
                <button
                  type="button"
                  className={detailTab === 'Overview' ? 'active' : ''}
                  onClick={() => setDetailTab('Overview')}
                >
                  <Briefcase size={14} />
                  Overview
                </button>
                <button
                  type="button"
                  className={detailTab === 'Contact' ? 'active' : ''}
                  onClick={() => setDetailTab('Contact')}
                >
                  <Phone size={14} />
                  Contact & Actions
                </button>
                <button
                  type="button"
                  className={detailTab === 'Notes' ? 'active' : ''}
                  onClick={() => setDetailTab('Notes')}
                >
                  <FileText size={14} />
                  Notes & Details
                </button>
              </div>

              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (busy) return;
                  try {
                    await saveLead(draft, newNote);
                    setNotice(
                      draft.id
                        ? `${draft.name} updated.`
                        : `${draft.name} added to leads.`,
                    );
                    setDraft(null);
                  } catch {
                    /* Provider displays the error; keep the draft. */
                  }
                }}
              >
                {detailTab === 'Overview' && (
                  <div className="lx-detail-fields">
                    <div className="lx-field-group">
                      <label htmlFor="lead-name" className="lx-field-label">
                        Full Name <span className="lx-req">*</span>
                      </label>
                      <Input
                        id="lead-name"
                        className="lx-field-input"
                        placeholder="e.g. Rahul Sharma"
                        required
                        value={draft.name}
                        onChange={(e) =>
                          setDraft({ ...draft, name: e.target.value })
                        }
                      />
                    </div>

                    <div className="lx-field-group">
                      <label htmlFor="lead-company" className="lx-field-label">
                        Company / Brand
                      </label>
                      <Input
                        id="lead-company"
                        className="lx-field-input"
                        placeholder="e.g. Apex Marketing"
                        value={draft.company}
                        onChange={(e) =>
                          setDraft({ ...draft, company: e.target.value })
                        }
                      />
                    </div>

                    <div className="lx-field-group">
                      <label htmlFor="lead-stage" className="lx-field-label">
                        Pipeline Stage
                      </label>
                      {formSelect('Lead stage', draft.stage, stageNames, (value) =>
                        setDraft({ ...draft, stage: value }),
                      )}
                    </div>

                    <div className="lx-field-group">
                      <label htmlFor="lead-priority" className="lx-field-label">
                        Priority / Temperature
                      </label>
                      {formSelect(
                        'Lead temperature',
                        draft.temperature || 'Normal',
                        ['Normal', 'Hot', 'Warm', 'Cold'],
                        (value) =>
                          setDraft({
                            ...draft,
                            temperature: value === 'Normal' ? '' : value,
                          }),
                      )}
                    </div>

                    <div className="lx-field-group">
                      <label htmlFor="lead-platform" className="lx-field-label">
                        Lead Source Platform
                      </label>
                      {formSelect(
                        'Lead platform',
                        draft.platform,
                        platforms,
                        (value) =>
                          setDraft({
                            ...draft,
                            platform: value,
                            source: value,
                          }),
                      )}
                    </div>

                    <div className="lx-field-group">
                      <label htmlFor="lead-owner" className="lx-field-label">
                        Assigned Owner
                      </label>
                      {formSelect(
                        'Lead owner',
                        draft.owner || 'Unassigned',
                        [
                          'Unassigned',
                          ...Array.from(
                            new Set([
                              ...owners,
                              ...leads
                                .map((lead) => lead.owner)
                                .filter(Boolean),
                            ]),
                          ),
                        ],
                        (value) =>
                          setDraft({
                            ...draft,
                            owner: value === 'Unassigned' ? '' : value,
                          }),
                      )}
                    </div>

                    <div className="lx-field-group">
                      <label htmlFor="lead-budget" className="lx-field-label">
                        Estimated Budget
                      </label>
                      <Input
                        id="lead-budget"
                        className="lx-field-input"
                        placeholder="e.g. ₹50,000 / month"
                        value={draft.budget}
                        onChange={(e) =>
                          setDraft({ ...draft, budget: e.target.value })
                        }
                      />
                    </div>

                    <div className="lx-field-group">
                      <label htmlFor="lead-service" className="lx-field-label">
                        Interested Service
                      </label>
                      <Input
                        id="lead-service"
                        className="lx-field-input"
                        placeholder="e.g. SEO & Meta Ads"
                        value={draft.service}
                        onChange={(e) =>
                          setDraft({ ...draft, service: e.target.value })
                        }
                      />
                    </div>

                    <div className="lx-field-group">
                      <label htmlFor="lead-city" className="lx-field-label">
                        City / Location
                      </label>
                      <Input
                        id="lead-city"
                        className="lx-field-input"
                        placeholder="e.g. Mumbai, Maharashtra"
                        value={draft.city}
                        onChange={(e) =>
                          setDraft({ ...draft, city: e.target.value })
                        }
                      />
                    </div>

                    <div className="lx-field-group">
                      <label htmlFor="lead-timeline" className="lx-field-label">
                        Project Timeline
                      </label>
                      <Input
                        id="lead-timeline"
                        className="lx-field-input"
                        placeholder="e.g. Immediate, 1-2 Months"
                        value={draft.timeline}
                        onChange={(e) =>
                          setDraft({ ...draft, timeline: e.target.value })
                        }
                      />
                    </div>

                    <div className="lx-field-group">
                      <label htmlFor="lead-followup" className="lx-field-label">
                        Follow-up Schedule
                      </label>
                      {formSelect(
                        'Lead follow-up',
                        draft.followUp,
                        [
                          'No follow-up',
                          'Due Today',
                          'Overdue',
                          'Upcoming (7d)',
                        ],
                        (value) => setDraft({ ...draft, followUp: value }),
                      )}
                    </div>

                    <div className="lx-field-group">
                      <label htmlFor="lead-followup-date" className="lx-field-label">
                        Follow-up Date
                      </label>
                      <Input
                        id="lead-followup-date"
                        type="date"
                        className="lx-field-input"
                        value={draft.followUpDate}
                        onChange={(e) =>
                          setDraft({ ...draft, followUpDate: e.target.value })
                        }
                      />
                    </div>
                  </div>
                )}

                {detailTab === 'Contact' && (
                  <div className="lx-contact-tab-content">
                    {draft.phone && (
                      <div className="lx-contact-actions-box">
                        <a
                          className="lx-contact-card-btn call"
                          href={`tel:${draft.phone.replace(/[^+\d]/g, '')}`}
                        >
                          <Phone size={16} />
                          Call Now
                        </a>
                        <a
                          className="lx-contact-card-btn wa"
                          href={`https://wa.me/${draft.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MessageSquare size={16} />
                          WhatsApp
                        </a>
                        {draft.email ? (
                          <a
                            className="lx-contact-card-btn mail"
                            href={`mailto:${draft.email}`}
                          >
                            <Mail size={16} />
                            Send Email
                          </a>
                        ) : (
                          <div
                            className="lx-contact-card-btn"
                            style={{ opacity: 0.5, cursor: 'not-allowed' }}
                          >
                            <Mail size={16} />
                            No Email
                          </div>
                        )}
                      </div>
                    )}

                    <div className="lx-detail-fields">
                      <div className="lx-field-group" style={{ gridColumn: 'span 2' }}>
                        <label htmlFor="lead-phone" className="lx-field-label">
                          Phone Number
                        </label>
                        <Input
                          id="lead-phone"
                          className="lx-field-input"
                          type="tel"
                          placeholder="+91 98765 43210"
                          value={draft.phone}
                          onChange={(e) =>
                            setDraft({ ...draft, phone: e.target.value })
                          }
                        />
                      </div>

                      <div className="lx-field-group" style={{ gridColumn: 'span 2' }}>
                        <label htmlFor="lead-email" className="lx-field-label">
                          Email Address
                        </label>
                        <Input
                          id="lead-email"
                          className="lx-field-input"
                          type="email"
                          placeholder="client@example.com"
                          value={draft.email}
                          onChange={(e) =>
                            setDraft({ ...draft, email: e.target.value })
                          }
                        />
                      </div>

                      <div className="lx-field-group" style={{ gridColumn: 'span 2' }}>
                        <label htmlFor="lead-city-contact" className="lx-field-label">
                          City / Region
                        </label>
                        <Input
                          id="lead-city-contact"
                          className="lx-field-input"
                          placeholder="City, State"
                          value={draft.city}
                          onChange={(e) =>
                            setDraft({ ...draft, city: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                {detailTab === 'Notes' && (
                  <div className="lx-notes-panel">
                    <div className="lx-field-group">
                      <label htmlFor="lead-notes" className="lx-field-label">
                        Add Activity Note
                      </label>
                      <textarea
                        id="lead-notes"
                        className="lx-notes-textarea"
                        placeholder="Add requirements, meeting minutes, client feedback, or proposal discussions here..."
                        rows={4}
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                      />
                      <small className="lx-notes-help">
                        This note will be saved with your name and the current time.
                      </small>
                    </div>
                    <div className="lx-note-history">
                      <div className="lx-note-history-heading">
                        <strong>Note history</strong>
                        <span>
                          {draft.id
                            ? leadNotes.filter((note) => note.leadId === draft.id).length
                            : 0}{' '}
                          notes
                        </span>
                      </div>
                      {draft.id &&
                      leadNotes.some((note) => note.leadId === draft.id) ? (
                        leadNotes
                          .filter((note) => note.leadId === draft.id)
                          .sort(
                            (a, b) =>
                              new Date(b.updatedAt).getTime() -
                              new Date(a.updatedAt).getTime(),
                          )
                          .map((note) => (
                            <article className="lx-note-entry" key={note.id}>
                              <div className="lx-note-avatar" aria-hidden="true">
                                {note.userName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <header>
                                  <strong>{note.userName}</strong>
                                  <time dateTime={note.updatedAt}>
                                    {noteDateTime(note.updatedAt)}
                                  </time>
                                </header>
                                <p>{note.note}</p>
                              </div>
                            </article>
                          ))
                      ) : (
                        <p className="lx-note-empty">
                          {draft.id
                            ? 'No notes have been added yet.'
                            : 'Save the lead to start its note history.'}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div
                  className="ws-actions"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '100%',
                    marginTop: '20px',
                    paddingTop: '16px',
                    borderTop: '1px solid #f1f5f9',
                  }}
                >
                  <div>
                    {draft.id ? (
                      <Button
                        type="button"
                        className="ws-button lx-btn-danger"
                        disabled={busy}
                        onClick={() => void deleteLead(draft)}
                      >
                        <Trash2 size={13} />
                        Delete Lead
                      </Button>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      type="button"
                      className="ws-button ws-secondary"
                      onClick={() => setDraft(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="ws-button"
                      disabled={busy || !draft.name.trim()}
                    >
                      {draft.id ? (
                        'Save Changes'
                      ) : (
                        <>
                          <Plus size={14} />
                          Add Lead
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
