'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Mail, Leaf, CircleAlert, Building2, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Download, FileText, Folder, LayoutGrid, List, MoreHorizontal, Phone, Plus, Search, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import './workspace.css';
import LeadsExplorer from './leads';

type Row = (string | ReactNode)[];
type Lead = { name: string; company: string; stage: string; source: string; age: string; temperature: string };
const initialLeads: Lead[] = [
  ['Rohan Mehta', 'Cafe Chain', 'New Leads', 'Instagram', 'Today', ''],
  ['Simran Kaur', 'Fashion Brand', 'New Leads', 'Website', 'Today', ''],
  ['Amit Sharma', 'Real Estate', 'New Leads', 'Referral', 'Today', ''],
  ['Neha Bansal', 'Education', 'New Leads', 'Meta Ads', 'Today', ''],
  ['The Fitness Hub', 'Gym / Fitness', 'Contacted', 'Website', '2 days ago', 'Hot'],
  ['Glow Skincare', 'Beauty', 'Contacted', 'Instagram', '1 day ago', 'Warm'],
  ['Urban Nest', 'Real Estate', 'Contacted', 'Referral', '3 days ago', 'Warm'],
  ['PetCare Plus', 'Pet Care', 'Contacted', 'Website', '3 days ago', 'Warm'],
  ['Cafe Mocha', 'F&B', 'Interested', 'Instagram', '1 day ago', 'Hot'],
  ['EduBright', 'Education', 'Interested', 'Website', '2 days ago', 'Warm'],
  ['StyleVibe', 'Fashion', 'Interested', 'Meta Ads', '3 days ago', 'Warm'],
  ['MV Automotives', 'Automobile', 'Interested', 'Referral', '3 days ago', 'Warm'],
  ['Visionary Edits', 'Video Production', 'Proposal Sent', 'Referral', '1 day ago', 'Hot'],
  ['Homezy', 'Interior', 'Proposal Sent', 'Instagram', '2 days ago', 'Warm'],
  ['StudySphere', 'EdTech', 'Proposal Sent', 'Website', '3 days ago', 'Warm'],
  ['Karan Properties', 'Real Estate', 'Proposal Sent', 'Referral', '4 days ago', 'Warm'],
  ['FitFuel', 'Nutrition', 'Closed', 'Instagram', '5 days ago', 'Won'],
  ['GlowPro', 'Salon', 'Closed', 'Website', '6 days ago', 'Won'],
  ['Pixel Play', 'Gaming', 'Closed', 'Meta Ads', '1 week ago', 'Won'],
  ['Brand Reels', 'Social Media', 'Closed', 'Referral', '1 week ago', 'Won'],
  ['Northstar', 'Retail', 'Lost', 'Website', '1 week ago', 'Lost'],
].map(([name, company, stage, source, age, temperature]) => ({ name, company, stage, source, age, temperature }));
const initialClients = [
  ['FitFuel', 'Nutrition', 'Retainer', '3', '₹50,000', 'Active'],
  ['Visionary Edits', 'Video Production', 'Project', '2', '₹1,20,000', 'Active'],
  ['Urban Nest', 'Real Estate', 'Retainer', '2', '₹75,000', 'Active'],
  ['Glow Skincare', 'Beauty', 'Retainer', '4', '₹40,000', 'Active'],
  ['EduBright', 'Education', 'Project', '1', '₹60,000', 'Onboarding'],
  ['Homezy', 'Interior', 'Project', '2', '₹90,000', 'Active'],
];
const initialTasks = [
  ['Upload Reel 3', 'FitFuel', '27 May', 'In Progress', 'Aman Gupta'],
  ['Client Report', 'Glow Skincare', '28 May', 'Pending', 'Ritika Das'],
  ['Ad Creative Review', 'Visionary Edits', '28 May', 'Pending', 'Karan Verma'],
  ['Monthly Report', 'Urban Nest', '30 May', 'Not Started', 'Aman Gupta'],
  ['Strategy Meeting', 'EduBright', '30 May', 'Not Started', 'Neha Jain'],
];
const teamRows = [
  ['Aman Gupta', 'Project Manager', '12', '8', '1/1', '8h 20m', 'Active'],
  ['Ritika Das', 'Content Creator', '5', '6', '1/1', '7h 15m', 'Active'],
  ['Karan Verma', 'Video Editor', '8', '7', '1/1', '8h 45m', 'Active'],
  ['Neha Jain', 'Ad Manager', '6', '5', '0/1', '8h 10m', 'Attention'],
  ['Rahul Sharma', 'BD Executive', '20', '10', '1/1', '9h 00m', 'Active'],
];
const reportRows = [
  ['FitFuel', '3/4', 'Submitted', 'On Track', '24 May 2025'],
  ['Visionary Edits', '4/4', 'Submitted', 'On Track', '31 May 2025'],
  ['Urban Nest', '2/4', 'Pending', 'Delayed', '18 May 2025'],
  ['Glow Skincare', '4/4', 'Submitted', 'On Track', '30 May 2025'],
];
const invoiceRows = [
  ['INV-1048', 'FitFuel', '₹50,000', 'Paid', '02 Jun 2025'],
  ['INV-1049', 'Urban Nest', '₹75,000', 'Pending', '05 Jun 2025'],
  ['INV-1050', 'Glow Skincare', '₹40,000', 'Pending', '10 Jun 2025'],
  ['INV-1051', 'Visionary Edits', '₹1,20,000', 'Overdue', '15 May 2025'],
];

function Action({ children, onClick, secondary = false, type = 'button' }: { children: ReactNode; onClick?: () => void; secondary?: boolean; type?: 'button' | 'submit' }) {
  return <Button type={type} className={`ws-button ${secondary ? 'ws-secondary' : ''}`} onClick={onClick}>{children}</Button>;
}
function Tabs({ items, active, onChange }: { items: string[]; active: string; onChange: (value: string) => void }) {
  return <div className="ws-tabs" aria-label="View options">{items.map(item => <Button key={item} className={active === item ? 'selected' : ''} aria-pressed={active === item} onClick={() => onChange(item)}>{item === 'Kanban' && <LayoutGrid size={13}/>} {item === 'List' && <List size={13}/>} {item}</Button>)}</div>;
}
function Badge({ value }: { value: string }) {
  const tone = /Active|Paid|Submitted|On Track|Completed|Won|Closed/.test(value) ? 'green' : /Pending|Onboarding|Attention|Warm/.test(value) ? 'amber' : /Overdue|Delayed|Not Started|Hot|Lost/.test(value) ? 'red' : 'blue';
  return <span className={`ws-badge ${tone}`}>{value}</span>;
}
function Identity({ name, person = false }: { name: string; person?: boolean }) {
  return <span className="ws-identity"><span className={`ws-initial ${person ? 'person' : ''}`}>{name.split(' ').map(x => x[0]).slice(0, 2).join('')}</span><span>{name}</span></span>;
}
function DataTable({ columns, rows, empty = 'No matching results.' }: { columns: string[]; rows: Row[]; empty?: string }) {
  return <div className="ws-table"><Table><TableHeader><TableRow>{columns.map((col, i) => <TableHead key={`${col}-${i}`}>{col}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row, i) => <TableRow key={i}>{row.map((cell, j) => <TableCell key={j}>{cell}</TableCell>)}</TableRow>)}{!rows.length && <TableRow><TableCell colSpan={columns.length}><div className="ws-empty">{empty}</div></TableCell></TableRow>}</TableBody></Table></div>;
}
function Heading({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <div className="workspace-toolbar"><div><h3>{title}</h3>{description && <p>{description}</p>}</div><div className="ws-actions">{children}</div></div>;
}
function SearchBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const id = useId();
  return <label className="table-search" htmlFor={id}><Search size={15}/><Input id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={label} aria-label={label}/></label>;
}
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <select className="ws-select" aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{options.map(option => <option key={option}>{option}</option>)}</select>;
}
function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <article className="ws-panel"><div className="ws-panel-heading"><h3>{title}</h3>{action}</div>{children}</article>;
}
function downloadText(name: string, content: string, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function RecordForm({ title, open, onClose, onSave, fields }: { title: string; open: boolean; onClose: () => void; onSave: (data: Record<string, string>) => void; fields: string[] }) {
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}><DialogContent className="ws-dialog"><DialogTitle>{title}</DialogTitle><DialogDescription>Enter the details for this record.</DialogDescription><form onSubmit={event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>; onSave(data); onClose(); }}>
    {fields.map((field, i) => <label key={field}>{field}<Input name={field} required={i === 0} placeholder={field}/></label>)}<div className="ws-actions"><Action secondary onClick={onClose}>Cancel</Action><Action type="submit">Save</Action></div>
  </form></DialogContent></Dialog>;
}

export default function WorkspaceContent({ active, navigate }: { active: string; navigate: (value: string) => void }) {
  return <div className="ws-content">
    {active === 'Dashboard' && <Dashboard navigate={navigate}/>}
    {active === 'Leads' && <LeadsExplorer initialLeads={initialLeads}/>}
    {active === 'Clients' && <ClientsView/>}
    {active === 'Projects' && <ProjectView/>}
    {active === 'Finance' && <FinanceView navigate={navigate}/>}
    {active === 'Agreements' && <AgreementsView/>}
    {active === 'Team' && <TeamView/>}
    {active === 'Reports' && <ReportsView/>}
    {(active === 'Tasks' || active === 'Calendar') && <TasksView key={active} calendar={active === 'Calendar'}/>}
    {active === 'Settings' && <SettingsView/>}
  </div>;
}

function Dashboard({ navigate }: { navigate: (value: string) => void }) {
  const stats = [['Total Leads', '248', '↑ 12%'], ['Active Clients', '36', '↑ 8%'], ['Ongoing Projects', '42', '↑ 5%'], ['Team Members', '18', ''], ['Monthly Revenue', '₹12.5L', '↑ 18%']];
  const revenue = [4, 7, 10, 12, 16, 19].map((amount, i) => ({ month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i], amount }));
  return <><section className="welcome ws-welcome"><div><h2>Good evening, Admin <span>👋</span></h2><p>Here’s what’s happening at Short Marketing today.</p></div></section>
    <div className="ws-stats five">{stats.map(([label, value, change]) => <article key={label}><span>{label}</span><div><strong>{value}</strong><em>{change}</em></div></article>)}</div>
    <div className="ws-dashboard-grid">
      <Panel title="Revenue Overview"><ChartContainer className="ws-revenue-chart" config={{ amount: { label: 'Revenue (₹L)', color: '#5841ed' } }}><AreaChart data={revenue} margin={{ top: 18, right: 12, left: -22, bottom: 0 }}><defs><linearGradient id="ws-revenue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6248ef" stopOpacity={0.25}/><stop offset="100%" stopColor="#6248ef" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#eef0f6"/><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis tickFormatter={v => v === 0 ? '0' : `₹${v}L`} domain={[0, 20]} ticks={[0, 5, 10, 15, 20]} axisLine={false} tickLine={false}/><ChartTooltip content={<ChartTooltipContent/>}/><Area dataKey="amount" type="linear" stroke="#5841ed" strokeWidth={2} fill="url(#ws-revenue)" dot={{ r: 3, fill: '#5841ed' }} isAnimationActive={false}/></AreaChart></ChartContainer></Panel>
      <Panel title="Project Status"><div className="ws-project-status"><figure className="ws-donut" aria-label="42 projects: 18 completed, 12 in progress, 6 on hold, 6 not started"><div><strong>42</strong><small>Projects</small></div></figure><ul>{[['Completed', '18', '#2f98f5'], ['In Progress', '12', '#25c498'], ['On Hold', '6', '#ffc34e'], ['Not Started', '6', '#ee6485']].map(([label, count, color]) => <li key={label}><i style={{ background: color }}/><span>{label}</span><b>{count}</b></li>)}</ul></div></Panel>
      <Panel title="Tasks Due This Week"><div className="ws-due-list">{[['Elara · Monthly Report', 'Today'], ['OMG · Ad Creative Review', 'Tomorrow'], ['Minicuts · Client Call', 'Tomorrow'], ['Awsy Education · Reel Upload', '29 May'], ['FRS · Strategy Meeting', '30 May']].map(([task, date]) => <button key={task} onClick={() => navigate('Tasks')}><Clock3 size={14}/><span>{task}</span><time className={date === 'Today' ? 'urgent' : ''}>{date}</time></button>)}</div></Panel>
    </div>
  </>;
}

function ClientsView() {
  const [clients, setClients] = useState(initialClients);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All Clients');
  const [type, setType] = useState('All types');
  const [create, setCreate] = useState(false);
  const [client, setClient] = useState<string | null>(null);
  if (client) return <ProjectView client={client} onBack={() => setClient(null)}/>;
  return <><Heading title="Clients" description="Manage all your clients and view their projects, billing and communication."><SearchBox value={query} onChange={setQuery} label="Search clients..."/><Select label="Client type" value={type} options={['All types', 'Retainer', 'Project']} onChange={setType}/><Action onClick={() => setCreate(true)}><Plus size={14}/>Add Client</Action></Heading>
    <div className="ws-stage-tabs">{['All Clients', 'Active', 'Onboarding', 'Inactive'].map(item => <Button key={item} className={status === item ? 'selected' : ''} aria-pressed={status === item} onClick={() => setStatus(item)}>{item}<span>{clients.filter(row => item === 'All Clients' || row[5] === item).length}</span></Button>)}</div>
    <DataTable columns={['Client Name', 'Industry', 'Type', 'Projects', 'Monthly Value', 'Status', 'Action']} rows={clients.filter(row => row.join(' ').toLowerCase().includes(query.toLowerCase()) && (status === 'All Clients' || row[5] === status) && (type === 'All types' || row[2] === type)).map(row => [<button key="name" className="ws-name-button" onClick={() => setClient(row[0])}><Identity name={row[0]}/></button>, ...row.slice(1, 5), <Badge key="status" value={row[5]}/>, <button key="action" className="ws-row-action" aria-label={`View ${row[0]} projects`} onClick={() => setClient(row[0])}><MoreHorizontal size={17}/></button>])}/>
    <RecordForm title="Add Client" open={create} onClose={() => setCreate(false)} fields={['Client Name', 'Industry', 'Monthly Value']} onSave={data => setClients([...clients, [data['Client Name'], data.Industry || '—', 'Retainer', '0', data['Monthly Value'] || '₹0', 'Onboarding']])}/>
  </>;
}

function ProjectView({ client: initialClient = 'FitFuel', onBack }: { client?: string; onBack?: () => void }) {
  const [client, setClient] = useState(initialClient);
  const [tab, setTab] = useState('Overview');
  const [notes, setNotes] = useState('Prepare next month’s content calendar and confirm campaign deliverables.');
  const [saved, setSaved] = useState(false);
  const [members, setMembers] = useState(teamRows.slice(0, 4).map(row => ({ name: row[0], role: row[0] === 'Aman Gupta' ? 'Account Manager' : row[1], email: '', phone: '' })));
  const [addingMember, setAddingMember] = useState(false);
  const [contactIndex, setContactIndex] = useState<number | null>(null);
  const activities = [
    ['Aman Gupta', 'uploaded Reel 3', 'Added to Content Calendar', '25 May 2025', '3:24 PM'],
    ['Ritika Das', 'completed content calendar', 'May week 4 content completed', '24 May 2025', '11:16 AM'],
    ['Karan Verma', 'added ad creatives', '3 new ad creatives uploaded', '23 May 2025', '5:40 PM'],
    ['Neha Jain', 'commented on client feedback', '“Looks great! Let’s proceed with next week’s plan.”', '22 May 2025', '2:08 PM'],
    ['Rahul Sharma', 'updated project timeline', 'Extended campaign timeline by 1 week', '21 May 2025', '10:33 AM'],
  ];
  const clientInfo = initialClients.find(row => row[0] === client) || [client, 'Agency client', 'Retainer', '0', '₹0', 'Onboarding'];
  return <div className="ws-project-detail"><Heading title="Client Project Progress"><Select label="Select client project" value={client} options={Array.from(new Set([initialClient, ...initialClients.map(row => row[0])]))} onChange={setClient}/><Action secondary onClick={() => setTab('Marketing Assets')}><Folder size={14}/>Marketing Assets</Action></Heading>
    {onBack && <button className="ws-link ws-back" onClick={onBack}><ArrowLeft size={13}/>Back to Clients</button>}
    <div className="ws-client-summary"><span className="ws-client-logo project-logo">{client === 'FitFuel' ? <Leaf size={25}/> : <Building2 size={25}/>}<strong>{client}</strong></span><div><h3>{client} <Badge value={clientInfo[5]}/></h3><p>{clientInfo[1]} Brand | {clientInfo[2]} Basis</p><strong>Account Manager: Aman Gupta</strong></div><dl><div><dt>Start Date</dt><dd>01 Jan 2025</dd></div><div><dt>End Date</dt><dd>31 Dec 2025</dd></div><div><dt>Monthly Value</dt><dd>{clientInfo[4]}</dd></div></dl></div>
    <Tabs items={['Overview', 'Tasks', 'Reports', 'Team', 'Files', 'Billing', 'Notes']} active={tab} onChange={setTab}/>
    {tab === 'Overview' && <div className="ws-project-grid">
      <div className="ws-project-primary">
        <Panel title="Monthly Progress (May 2025)" action={<strong className="ws-progress-value">70%</strong>}>
          <div className="ws-progress-row"><progress value={70} max={100} aria-label="Monthly progress"/></div>
          <div className="ws-deliverables">{['Content (8/12)', 'Reels (4/6)', 'Ads (3/4)', 'Reports (3/4)'].map((item, i) => <span key={item}><i style={{ background: ['#27bc91', '#338cf4', '#ffb755', '#9566f5'][i] }}/>{item}</span>)}</div>
        </Panel>
        <Panel title="Recent Activity"><ol className="ws-timeline">{activities.map(([name, action, detail, date, time], i) => <li key={name}>
          <span className={`ws-team-avatar avatar-tone-${i % 4}`}>{name.split(' ').map(word => word[0]).join('')}</span>
          <div className="ws-timeline-copy"><p><strong>{name}</strong> {action}</p><small>{detail}</small></div>
          <time>{date}<span>{time}</span></time>
        </li>)}</ol></Panel>
      </div>
      <div className="ws-project-secondary">
        <Panel title="Report Status">
          <div className="ws-project-report"><span className="ws-report-check"><Check size={18}/></span><div><strong>Weekly Reports</strong><small>3/4 Submitted</small></div><button className="ws-outline-link" onClick={() => setTab('Reports')}>View Reports</button></div>
          <div className="ws-project-report"><span className="ws-report-check"><Check size={18}/></span><div><strong>Monthly Report</strong><small className="success">Submitted</small></div></div>
          <div className="ws-project-report"><span className="ws-report-check alert"><CircleAlert size={18}/></span><div><strong>Client Report</strong><small className="pending">Pending approval</small></div></div>
        </Panel>
        <Panel title="Assigned Team"><div className="ws-member-list">{members.map((member, i) => <div className="ws-member" key={`${member.name}-${i}`}>
          <span className={`ws-team-avatar avatar-tone-${i % 4}`}>{member.name.split(' ').map(word => word[0]).slice(0, 2).join('')}<i/></span>
          <div className="ws-member-copy"><strong>{member.name}</strong><small>{member.role}</small></div>
          <button className="ws-contact-button" aria-label={`Contact details for ${member.name}`} onClick={() => setContactIndex(i)}><Mail size={16}/></button>
          <button className="ws-contact-button" aria-label={`Phone details for ${member.name}`} onClick={() => setContactIndex(i)}><Phone size={16}/></button>
        </div>)}</div><button className="ws-add-member" onClick={() => setAddingMember(true)}><Plus size={17}/>Add Member</button></Panel>
      </div>
    </div>}
    {tab === 'Tasks' && <DataTable columns={['Task', 'Project', 'Due Date', 'Status']} rows={initialTasks.filter(row => row[1] === client).map(row => [...row.slice(0, 3), <Badge key="status" value={row[3]}/>])}/>}
    {tab === 'Reports' && <DataTable columns={['Client', 'Weekly Reports', 'Monthly Report', 'Status', 'Last Submitted']} rows={reportRows.filter(row => row[0] === client).map(row => [row[0], row[1], <Badge key="report" value={row[2]}/>, <Badge key="status" value={row[3]}/>, row[4]])}/>}
    {tab === 'Team' && <DataTable columns={['Member', 'Role', 'Status']} rows={members.map(member => [<Identity key="name" name={member.name} person/>, member.role, <Badge key="status" value="Active"/>])}/>}
    {(tab === 'Files' || tab === 'Marketing Assets') && <AssetsView/>}
    {tab === 'Billing' && <DataTable columns={['Invoice', 'Client', 'Amount', 'Status', 'Due']} rows={invoiceRows.filter(row => row[1] === client).map(row => [...row.slice(0, 3), <Badge key="status" value={row[3]}/>, row[4]])}/>}
    {tab === 'Notes' && <Panel title="Project Notes"><textarea className="ws-notes" aria-label="Project notes" value={notes} onChange={e => { setNotes(e.target.value); setSaved(false); }}/><Action onClick={() => setSaved(true)}>{saved ? 'Saved for this session' : 'Save Notes'}</Action></Panel>}
    <RecordForm title="Add Team Member" open={addingMember} onClose={() => setAddingMember(false)} fields={['Name', 'Role', 'Email', 'Phone']} onSave={data => setMembers([...members, { name: data.Name, role: data.Role || 'Team Member', email: data.Email || '', phone: data.Phone || '' }])}/>
    <Dialog open={contactIndex !== null} onOpenChange={open => { if (!open) setContactIndex(null); }}><DialogContent className="ws-dialog"><DialogTitle>{contactIndex !== null ? members[contactIndex].name : 'Team Contact'}</DialogTitle><DialogDescription>View or update this team member’s contact details.</DialogDescription>{contactIndex !== null && <form onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); const email = data.get('email'); const phone = data.get('phone'); setMembers(members.map((member, i) => i === contactIndex ? { ...member, email: typeof email === 'string' ? email : '', phone: typeof phone === 'string' ? phone : '' } : member)); setContactIndex(null); }}><label htmlFor="member-email">Email<Input id="member-email" type="email" name="email" defaultValue={members[contactIndex].email} placeholder="Add email address"/></label><label htmlFor="member-phone">Phone<Input id="member-phone" type="tel" name="phone" defaultValue={members[contactIndex].phone} placeholder="Add phone number"/></label><Action type="submit">Save Contact</Action></form>}</DialogContent></Dialog>
  </div>;
}

function FinanceView({ navigate }: { navigate: (page: string) => void }) {
  const [tab, setTab] = useState('Overview');
  const [month, setMonth] = useState('May 2025');
  const [invoices, setInvoices] = useState(invoiceRows);
  const [create, setCreate] = useState(false);
  const stats = month === 'May 2025' ? [['Total Invoiced', '₹12,50,000', '↑ 18%'], ['Paid', '₹8,70,000', '↑ 12%'], ['Pending', '₹3,80,000', '↓ 5%'], ['Overdue', '₹1,20,000', '↓ 8%']] : [['Total Invoiced', '₹10,60,000', '↑ 10%'], ['Paid', '₹7,76,000', '↑ 8%'], ['Pending', '₹2,84,000', '↓ 3%'], ['Overdue', '₹1,30,000', '↓ 2%']];
  return <><Heading title="Finance Center" description="Track invoices, payments, agreements and financial health."><Select label="Finance month" value={month} options={['May 2025', 'April 2025']} onChange={setMonth}/></Heading><Tabs items={['Overview', 'Invoices', 'Payments', 'Agreements', 'Expenses', 'Profit & Loss']} active={tab} onChange={setTab}/>
    {tab === 'Overview' && <><div className="ws-stats">{stats.map(([label, value, change], i) => <article key={label}><span>{label}</span><strong>{value}</strong><em className={i > 1 ? 'negative' : ''}>{change}</em></article>)}</div><div className="ws-two-columns"><Panel title="Upcoming Payments" action={<button className="ws-link" onClick={() => setTab('Invoices')}>View All</button>}><div className="ws-payment-list">{invoiceRows.map(row => <button key={row[0]} onClick={() => setTab('Invoices')}><Identity name={row[1]}/><small>Due {row[4]}</small><span>{row[2]}</span></button>)}</div></Panel><Panel title="Quick Actions"><div className="ws-quick-actions"><button onClick={() => setCreate(true)}><FileText/>Create Invoice</button><button onClick={() => navigate('Agreements')}><FileText/>Generate Agreement</button><button onClick={() => navigate('Agreements')}><FileText/>Create Invoice + Agreement</button><button onClick={() => setTab('Payments')}><CalendarDays/>Track Payments</button></div></Panel></div></>}
    {(tab === 'Invoices' || tab === 'Payments') && <><div className="ws-subtoolbar"><h4>{tab === 'Payments' ? 'Received Payments' : 'All Invoices'}</h4><Action onClick={() => setCreate(true)}><Plus size={14}/>Create Invoice</Action></div><DataTable columns={['Invoice', 'Client', 'Amount', 'Status', 'Due Date']} rows={invoices.filter(row => tab !== 'Payments' || row[3] === 'Paid').map(row => [...row.slice(0, 3), <Badge key="status" value={row[3]}/>, row[4]])}/></>}
    {tab === 'Agreements' && <><DataTable columns={['Agreement', 'Client', 'Type', 'Status']} rows={initialClients.slice(0, 3).map(row => ['Master Services Agreement', row[0], row[2], <Badge key="status" value="Active"/>])}/><div className="ws-subtoolbar"><Action onClick={() => navigate('Agreements')}>Generate Agreement</Action></div></>}
    {tab === 'Expenses' && <DataTable columns={['Expense', 'Category', 'Amount', 'Date']} rows={month === 'May 2025' ? [['Creative software', 'Subscriptions', '₹18,500', '01 May 2025'], ['Production studio', 'Production', '₹35,000', '12 May 2025'], ['Campaign tools', 'Marketing', '₹12,000', '15 May 2025']] : [['Creative software', 'Subscriptions', '₹18,500', '01 Apr 2025'], ['Location rental', 'Production', '₹25,000', '18 Apr 2025']]}/>}
    {tab === 'Profit & Loss' && <Panel title={`Profit & Loss · ${month}`}><DataTable columns={['Description', 'Amount']} rows={month === 'May 2025' ? [['Revenue received', '₹8,70,000'], ['Operating expenses', '₹65,500'], ['Net operating income', '₹8,04,500']] : [['Revenue received', '₹7,76,000'], ['Operating expenses', '₹43,500'], ['Net operating income', '₹7,32,500']]}/></Panel>}
    <RecordForm title="Create Invoice" open={create} onClose={() => setCreate(false)} fields={['Client', 'Amount', 'Due Date']} onSave={data => setInvoices([...invoices, [`INV-${1048 + invoices.length}`, data.Client, data.Amount || '₹0', 'Pending', data['Due Date'] || '—']])}/>
  </>;
}

function AgreementsView() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Record<string, string>>({ 'Client Name': 'FitFuel', 'Company Name': 'FitFuel Nutrition Pvt Ltd', Email: 'aman@fitfuel.com', Phone: '+91 98765 43210', Address: 'B-12, Sector 62, Noida, UP 201301', 'GST Number (Optional)': '09ABCDE1234F1Z5', 'Project Name': 'Social Media Retainer', Services: 'Content strategy, social media management, reels and monthly reporting', 'Start Date': '01 Jan 2025', 'End Date': '31 Dec 2025', 'Monthly Fee': '₹50,000', 'Payment Terms': 'Due within 15 days of invoice', 'Notice Period': '30 days', 'Tax Rate': '18%' });
  const steps = ['Client Details', 'Project & Services', 'Commercials', 'Review & Generate'];
  const fields = [['Client Name', 'Company Name', 'Email', 'Phone', 'Address', 'GST Number (Optional)'], ['Project Name', 'Services', 'Start Date', 'End Date'], ['Monthly Fee', 'Payment Terms', 'Notice Period', 'Tax Rate']];
  const agreement = `MASTER SERVICES AGREEMENT\n\nShort Marketing × ${form['Client Name']}\n\nClient: ${form['Company Name']}\nEmail: ${form.Email}\nPhone: ${form.Phone}\nAddress: ${form.Address}\n\nProject: ${form['Project Name']}\nServices: ${form.Services}\nTerm: ${form['Start Date']} – ${form['End Date']}\nMonthly Fee: ${form['Monthly Fee']}\nTax Rate: ${form['Tax Rate']}\nPayment Terms: ${form['Payment Terms']}\nNotice Period: ${form['Notice Period']}\n\nClient signature: ____________________\nAgency signature: ____________________\n\nINVOICE DRAFT\nClient: ${form['Company Name']}\nDescription: ${form['Project Name']}\nMonthly Fee: ${form['Monthly Fee']}\nTax: ${form['Tax Rate']}\nPayment Terms: ${form['Payment Terms']}\n`;
  return <><Heading title="Agreement Generator"/><div className="ws-agreement-grid"><section><div className="ws-steps">{steps.map((label, i) => <button key={label} className={step === i ? 'selected' : ''} onClick={() => setStep(i)}><span>{i + 1}</span>{label}{i < 3 && <ChevronRight size={12}/>}</button>)}</div><Panel title={step === 0 ? 'Client Information' : steps[step]}>{step < 3 ? <form onSubmit={e => { e.preventDefault(); setStep(step + 1); }}><div className="ws-form-grid">{fields[step].map(field => <label key={field}>{field}{!field.includes('Optional') && <em> *</em>}<Input required={!field.includes('Optional')} type={field === 'Email' ? 'email' : 'text'} value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })}/></label>)}</div><div className="ws-form-footer">{step > 0 && <Action secondary onClick={() => setStep(step - 1)}>Back</Action>}<Action type="submit">Continue<ChevronRight size={14}/></Action></div></form> : <><dl className="ws-review">{Object.entries(form).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><Action onClick={() => downloadText('agreement-and-invoice-draft.txt', agreement)}><Download size={14}/>Generate Agreement & Invoice</Action></>}</Panel></section><Panel title="Agreement Preview"><div className="ws-paper"><div className="ws-paper-brand"><strong>Short Marketing</strong><span className="ws-client-logo"><Building2 size={22}/></span></div><h4>MASTER SERVICES AGREEMENT</h4><p>This agreement is between Short Marketing and <strong>{form['Company Name']}</strong>.</p><h5>01 · Scope of Services</h5><p>{form.Services}</p><h5>02 · Term & Commercials</h5><p>{form['Start Date']} – {form['End Date']}</p><p>{form['Monthly Fee']} / month · Tax {form['Tax Rate']}</p><p>{form['Payment Terms']}</p><div className="ws-signatures"><span>Client Signature</span><span>Agency Signature</span></div></div><Action onClick={() => setStep(3)}><Download size={14}/>Review Agreement & Invoice</Action></Panel></div></>;
}

function TeamView() {
  const [tab, setTab] = useState('Daily Activity');
  const [team, setTeam] = useState('All Teams');
  const [date, setDate] = useState('2025-05-27');
  const filtered = teamRows.filter(row => team === 'All Teams' || (team === 'Creative' ? /Content|Video/.test(row[1]) : /Manager|Executive/.test(row[1])));
  return <><Heading title="Employee / Team Activity"><Input className="ws-date" aria-label="Activity date" type="date" value={date} onChange={e => setDate(e.target.value)}/><Select label="Team filter" value={team} options={['All Teams', 'Creative', 'Operations']} onChange={setTeam}/></Heading><Tabs items={['Daily Activity', 'Calls', 'Tasks', 'Reports', 'Time Tracking', 'HR']} active={tab} onChange={setTab}/>
    {date !== '2025-05-27' ? <div className="ws-empty">No activity recorded for this date.</div> : tab === 'Daily Activity' ? <DataTable columns={['Name', 'Role', 'Calls', 'Tasks', 'Reports', 'Working Hours', 'Status']} rows={filtered.map(row => [<Identity key="name" name={row[0]} person/>, ...row.slice(1, 6), <Badge key="status" value={row[6]}/>])}/> : tab === 'HR' ? <DataTable columns={['Employee', 'Role', 'Department', 'Status']} rows={filtered.map(row => [<Identity key="name" name={row[0]} person/>, row[1], /Content|Video/.test(row[1]) ? 'Creative' : 'Operations', <Badge key="status" value={row[6]}/>])}/> : <DataTable columns={['Name', 'Role', tab === 'Time Tracking' ? 'Working Hours' : tab, 'Status']} rows={filtered.map(row => [<Identity key="name" name={row[0]} person/>, row[1], row[tab === 'Calls' ? 2 : tab === 'Tasks' ? 3 : tab === 'Reports' ? 4 : 5], <Badge key="status" value={row[6]}/>])}/>}
  </>;
}

function ReportsView() {
  const [tab, setTab] = useState('Client Reports');
  const [client, setClient] = useState('All Clients');
  const [month, setMonth] = useState('May 2025');
  const [selected, setSelected] = useState<string[] | null>(null);
  const filtered = month === 'May 2025' ? reportRows.filter(row => client === 'All Clients' || row[0] === client) : [];
  const rows: string[][] = tab === 'Team Reports' ? teamRows.map(row => [row[0], row[1], row[4], row[6]]) : tab === 'Performance' ? filtered.map(row => [row[0], row[1], row[3], row[4]]) : filtered;
  return <><Heading title="Reports"><Select label="Report client" value={client} options={['All Clients', ...reportRows.map(row => row[0])]} onChange={setClient}/><Select label="Report month" value={month} options={['May 2025', 'April 2025']} onChange={setMonth}/><Action onClick={() => downloadText('crm-report.txt', `${tab} · ${month}\n\n${rows.map(row => row.join(' | ')).join('\n') || 'No reports for this period.'}`)}><Download size={14}/>Generate Report</Action></Heading><Tabs items={['Client Reports', 'Team Reports', 'Performance', 'Custom Reports']} active={tab} onChange={setTab}/>
    {tab === 'Team Reports' ? <DataTable columns={['Team Member', 'Role', 'Reports Submitted', 'Status']} rows={rows.map(row => [<Identity key="name" name={row[0]} person/>, row[1], row[2], <Badge key="status" value={row[3]}/>])}/> : tab === 'Performance' ? <DataTable columns={['Client', 'Weekly Delivery', 'Health', 'Last Submitted']} rows={rows.map(row => [<Identity key="name" name={row[0]}/>, row[1], <Badge key="status" value={row[2]}/>, row[3]])}/> : <DataTable columns={['Client', 'Weekly Reports', 'Monthly Report', 'Status', 'Last Submitted', 'Action']} rows={filtered.map(row => [<Identity key="name" name={row[0]}/>, row[1], <Badge key="report" value={row[2]}/>, <Badge key="status" value={row[3]}/>, row[4], <button key="view" className="ws-link" onClick={() => setSelected(row)}>View</button>])}/>}
    {tab === 'Custom Reports' && <p className="ws-hint">Choose a client and month above, then generate a report for that selection.</p>}
    <Dialog open={selected !== null} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="ws-dialog"><DialogTitle>{selected?.[0]} · Monthly Report</DialogTitle><DialogDescription>{month}</DialogDescription>{selected && <dl className="ws-review">{['Weekly Reports', 'Monthly Report', 'Status', 'Last Submitted'].map((label, i) => <div key={label}><dt>{label}</dt><dd>{selected[i + 1]}</dd></div>)}</dl>}</DialogContent></Dialog>
  </>;
}

function TasksView({ calendar }: { calendar: boolean }) {
  const [tab, setTab] = useState(calendar ? 'Calendar' : 'My Tasks');
  const [tasks, setTasks] = useState(initialTasks);
  const [create, setCreate] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const month = new Date(2025, 4 + monthOffset, 1);
  const firstDay = (month.getDay() + 6) % 7;
  const days = new Date(2025, 5 + monthOffset, 0).getDate();
  const filtered = tab === 'My Tasks' ? tasks.filter(row => row[4] === 'Aman Gupta') : tasks;
  return <><Heading title="Tasks & Calendar"><Action onClick={() => setCreate(true)}><Plus size={14}/>Add Task</Action></Heading><Tabs items={['My Tasks', 'Team Tasks', 'Calendar']} active={tab} onChange={setTab}/>
    {tab !== 'Calendar' ? <DataTable columns={['', 'Task', 'Project', 'Due Date', 'Status']} rows={filtered.map(row => [<input key="check" type="checkbox" aria-label={`Complete ${row[0]}`} checked={row[3] === 'Completed'} onChange={e => setTasks(tasks.map(task => task === row ? [...task.slice(0, 3), e.target.checked ? 'Completed' : 'Not Started', task[4]] : task))}/>, <span key="task" className={row[3] === 'Completed' ? 'ws-completed' : ''}>{row[0]}</span>, row[1], row[2], <Badge key="status" value={row[3]}/>])}/> : <section className="ws-calendar"><div className="ws-subtoolbar"><h4>{month.toLocaleDateString('en', { month: 'long', year: 'numeric' })}</h4><div className="ws-actions"><button className="ws-row-action" aria-label="Previous month" onClick={() => setMonthOffset(monthOffset - 1)}><ChevronLeft size={17}/></button><button className="ws-link" onClick={() => setMonthOffset(0)}>May 2025</button><button className="ws-row-action" aria-label="Next month" onClick={() => setMonthOffset(monthOffset + 1)}><ChevronRight size={17}/></button></div></div><div className="ws-calendar-grid">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <strong key={day}>{day}</strong>)}{Array.from({ length: firstDay }, (_, i) => <div key={`blank-${i}`} className="blank"/>)}{Array.from({ length: days }, (_, i) => <div key={i} className={monthOffset === 0 && i === 26 ? 'today' : ''}><time>{i + 1}</time>{tasks.filter(task => task[2] === `${i + 1} ${month.toLocaleDateString('en', { month: 'short' })}`).map(task => <button key={task[0]} onClick={() => setTab('Team Tasks')}>{task[0]}</button>)}</div>)}</div></section>}
    <RecordForm title="Add Task" open={create} onClose={() => setCreate(false)} fields={['Task', 'Project', 'Due Date (e.g. 28 May)']} onSave={data => setTasks([...tasks, [data.Task, data.Project || 'Internal', data['Due Date (e.g. 28 May)'] || '27 May', 'Not Started', 'Aman Gupta']])}/>
  </>;
}

function AssetsView() {
  const [tab, setTab] = useState('Content Library');
  const [folder, setFolder] = useState<string | null>(null);
  const [files, setFiles] = useState<{ name: string; folder: string; size: string }[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const folders = tab === 'Brand Kit' ? ['Logos & Brand', 'Brand Guidelines', 'Fonts', 'Color Palettes'] : tab === 'Templates' ? ['Proposals', 'Reports', 'Contracts', 'Client Assets'] : tab === 'Ad Creatives' ? ['Meta Ads', 'Google Ads', 'Video Ads', 'Campaign Copy'] : ['Social Media Posts', 'Reels', 'Ad Creatives', 'Client Assets', 'Proposals', 'Reports', 'Contracts', 'Logos & Brand'];
  return <section className="ws-assets"><Heading title="Marketing Assets"><Action onClick={() => fileInput.current?.click()}><Upload size={14}/>Upload</Action><input ref={fileInput} hidden type="file" multiple onChange={e => { const added = Array.from(e.target.files || []).map(file => ({ name: file.name, folder: folder || folders[0], size: `${Math.max(1, Math.round(file.size / 1024))} KB` })); setFiles([...files, ...added]); e.target.value = ''; }}/></Heading><Tabs items={['Brand Kit', 'Content Library', 'Templates', 'Ad Creatives']} active={tab} onChange={value => { setTab(value); setFolder(null); }}/>{folder ? <><button className="ws-link ws-back" onClick={() => setFolder(null)}><ArrowLeft size={13}/>All folders</button><DataTable columns={['File Name', 'Size']} rows={files.filter(file => file.folder === folder).map(file => [file.name, file.size])} empty={`No files in ${folder}. Use Upload to add files for this session.`}/></> : <div className="ws-folder-grid">{folders.map((item, i) => <button key={item} onClick={() => setFolder(item)}><span className={`ws-folder-icon color-${i % 4}`}><Folder size={24} fill="currentColor"/></span><span><strong>{item}</strong><small>{files.filter(file => file.folder === item).length} files</small></span></button>)}</div>}</section>;
}

function SettingsView() {
  const [tab, setTab] = useState('Workspace');
  const [saved, setSaved] = useState(false);
  return <><Heading title="Settings" description="Manage your workspace and personal preferences."/><Tabs items={['Workspace', 'Notifications', 'Integrations']} active={tab} onChange={value => { setTab(value); setSaved(false); }}/>{tab === 'Integrations' ? <Panel title="Connected Services"><div className="ws-report-status"><Building2 size={22}/><div><strong>CRM API</strong><small>Not connected · sample data is displayed</small></div><Badge value="Pending"/></div></Panel> : <Panel title={tab === 'Workspace' ? 'Workspace Profile' : 'Notification Preferences'}><form onSubmit={e => { e.preventDefault(); setSaved(true); }}><div className="ws-form-grid">{tab === 'Workspace' ? <><label htmlFor="workspace-name">Workspace Name<Input id="workspace-name" defaultValue="Short Marketing"/></label><label htmlFor="workspace-admin">Administrator<Input id="workspace-admin" defaultValue="Aman Gupta"/></label></> : <><label className="ws-checkbox-label"><input type="checkbox" defaultChecked/>Email notifications</label><label className="ws-checkbox-label"><input type="checkbox" defaultChecked/>In-app notifications</label></>}</div><div className="ws-form-footer"><Action type="submit">{saved ? <><Check size={14}/>Saved for this session</> : 'Save Changes'}</Action></div></form></Panel>}</>;
}
