'use client';

import { useState } from 'react';
import WorkspaceContent from './workspace';
import {
  ArrowUpRight, BarChart3, Bell, Building2, CalendarDays,
  CircleDollarSign, Check, FileText, FolderKanban, LayoutDashboard,
  Menu, MoreHorizontal, Search, Sparkles, Target, Users, X, Zap,
} from 'lucide-react';

const navigation = [
  { label: 'Overview', items: [['Dashboard', LayoutDashboard]] },
  { label: 'Workspace', items: [
    ['Leads', Target], ['Clients', Building2], ['Projects', FolderKanban],
    ['Tasks', Check], ['Calendar', CalendarDays],
  ] },
  { label: 'Business', items: [
    ['Finance', CircleDollarSign], ['Agreements', FileText],
    ['Team', Users], ['Reports', BarChart3],
  ] },
] as const;
export default function Home() {
  const [active, setActive] = useState('Dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="crm-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand"><span className="brand-mark"><Sparkles size={19}/></span><span className="brand-copy"><strong>SORTCRM</strong><small>Growth workspace</small></span></div>
        <button className="mobile-close" aria-label="Close menu" onClick={() => setMobileOpen(false)}><X size={20}/></button>
        <nav aria-label="Primary navigation">
          {navigation.map((group) => (
            <section className="nav-group" key={group.label} aria-labelledby={`nav-${group.label.toLowerCase()}`}>
              <h2 id={`nav-${group.label.toLowerCase()}`} className="nav-group-title">{group.label}</h2>
              {group.items.map(([label, Icon]) => (
                <button key={label} className={active === label ? 'nav-active' : ''} aria-current={active === label ? 'page' : undefined} onClick={() => { setActive(label); setMobileOpen(false); }}>
                  <Icon size={18}/><span>{label}</span>{label === 'Leads' && <b>12</b>}
                </button>
              ))}
            </section>
          ))}
        </nav>
        <button className="sidebar-health" onClick={() => { setActive('Leads'); setMobileOpen(false); }}>
          <span className="health-icon"><Zap size={15}/></span>
          <span><strong>Pipeline is healthy</strong><small>18% ahead of last month</small></span>
          <ArrowUpRight size={15}/>
        </button>
        <div className="user-card"><span className="avatar">AG</span><div><strong>Aman Gupta</strong><small>Administrator</small></div><button className="profile-options" aria-label="Workspace settings" onClick={() => { setActive('Settings'); setMobileOpen(false); }}><MoreHorizontal size={17}/></button></div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <button className="menu-button" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={21}/></button>
          <div><p>Workspace</p><h1>{active}</h1></div>
          <div className="topbar-actions"><label className="global-search"><Search size={16}/><input aria-label="Search CRM" placeholder="Search anything..."/></label><button aria-label="Notifications" className="icon-button"><Bell size={19}/><i/></button><span className="avatar">AG</span></div>
        </header>
        <div className="dashboard">
          <WorkspaceContent active={active} navigate={setActive}/>
        </div>
      </main>
      {mobileOpen && <button className="backdrop" aria-label="Close menu" onClick={() => setMobileOpen(false)}/>}
    </div>
  );
}
