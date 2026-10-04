'use client';

export const dynamic = 'force-static';

import { useEffect, useMemo, useRef, useState } from 'react';
import WorkspaceContent from './workspace';
import { CrmProvider, useCrm, useRecords } from './crm-data';
import {
  ArrowUpRight,
  Bell,
  Building2,
  CalendarDays,
  CalendarClock,
  CircleDollarSign,
  Check,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Target,
  Users,
  X,
  Zap,
} from 'lucide-react';
import NoveraLogo from './novera-logo';
import { getTodayScheduleNotifications } from './schedule-notifications';

const navigation = [
  { label: 'Overview', items: [['Dashboard', LayoutDashboard]] },
  {
    label: 'Workspace',
    items: [
      ['Leads', Target],
      ['Clients', Building2],
      ['Projects', FolderKanban],
      ['Tasks', Check],
      ['Calendar', CalendarDays],
    ],
  },
  {
    label: 'Business',
    items: [
      ['Finance', CircleDollarSign],
      ['Agreements', FileText],
      ['Team', Users],
    ],
  },
] as const;
export default function Home() {
  return (
    <CrmProvider>
      <Workspace />
    </CrmProvider>
  );
}
function Workspace() {
  const { user, logout } = useCrm();
  const leads = useRecords('leads');
  const initials = user.name
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('');
  const [active, setActive] = useState('Dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const [istDay, setIstDay] = useState<Date | null>(null);
  const scheduleNotifications = useMemo(
    () => (istDay ? getTodayScheduleNotifications(leads, istDay) : []),
    [leads, istDay],
  );
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('google')) return;
    const frame = requestAnimationFrame(() => setActive('Settings'));
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    setIstDay(new Date());
    const timer = window.setInterval(() => setIstDay(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!notificationsOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [notificationsOpen]);
  return (
    <div className="crm-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">
            <NoveraLogo />
          </span>
          <span className="brand-copy">
            <strong>NOVERA CRM</strong>
            <small>Growth workspace</small>
          </span>
        </div>
        <button
          className="mobile-close"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        >
          <X size={20} />
        </button>
        <nav aria-label="Primary navigation">
          {navigation.map((group) => (
            <section
              className="nav-group"
              key={group.label}
              aria-labelledby={`nav-${group.label.toLowerCase()}`}
            >
              <h2
                id={`nav-${group.label.toLowerCase()}`}
                className="nav-group-title"
              >
                {group.label}
              </h2>
              {group.items.map(([label, Icon]) => (
                <button
                  key={label}
                  className={active === label ? 'nav-active' : ''}
                  aria-current={active === label ? 'page' : undefined}
                  onClick={() => {
                    setActive(label);
                    setMobileOpen(false);
                  }}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  {label === 'Leads' && <b>{leads.length}</b>}
                </button>
              ))}
            </section>
          ))}
        </nav>
        <button
          className="sidebar-health"
          onClick={() => {
            setActive('Leads');
            setMobileOpen(false);
          }}
        >
          <span className="health-icon">
            <Zap size={15} />
          </span>
          <span>
            <strong>Lead pipeline</strong>
            <small>{leads.length} opportunities</small>
          </span>
          <ArrowUpRight size={15} />
        </button>
        <div className="user-card">
          <span className="avatar">{initials}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{user.role}</small>
          </div>
          <button
            className="profile-options"
            aria-label="Workspace settings"
            onClick={() => {
              setActive('Settings');
              setMobileOpen(false);
            }}
          >
            <MoreHorizontal size={17} />
          </button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <button
            className="menu-button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={21} />
          </button>
          <div>
            <p>Workspace</p>
            <h1>{active}</h1>
          </div>
          <div className="topbar-actions">
            <div className="notification-center" ref={notificationsRef}>
              <button
                className="notification-bell"
                aria-label={`${scheduleNotifications.length} schedule notification${scheduleNotifications.length === 1 ? '' : 's'}`}
                aria-expanded={notificationsOpen}
                aria-controls="schedule-notifications"
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell size={18} />
                {scheduleNotifications.length > 0 && (
                  <span className="notification-count">
                    {scheduleNotifications.length > 9 ? '9+' : scheduleNotifications.length}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <section
                  id="schedule-notifications"
                  className="notification-panel"
                  aria-label="Schedule notifications"
                >
                  <header>
                    <div>
                      <strong>Notifications</strong>
                      <span>Today in IST</span>
                    </div>
                    {scheduleNotifications.length > 0 && (
                      <b>{scheduleNotifications.length} due</b>
                    )}
                  </header>
                  <div className="notification-list">
                    {scheduleNotifications.map((notification) => (
                      <button
                        key={notification.id}
                        className="notification-item"
                        onClick={() => {
                          setActive('Leads');
                          setNotificationsOpen(false);
                        }}
                      >
                        <span className="notification-item-icon">
                          <CalendarClock size={17} />
                        </span>
                        <span>
                          <strong>Scheduled follow-up today</strong>
                          <small>
                            Today is the scheduled date for {notification.clientName}
                            {notification.company ? ` (${notification.company})` : ''}.
                          </small>
                        </span>
                      </button>
                    ))}
                    {scheduleNotifications.length === 0 && (
                      <div className="notification-empty">
                        <span><Bell size={20} /></span>
                        <strong>No schedules due today</strong>
                        <small>Client follow-ups scheduled for today will appear here.</small>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
            <button
              className="ws-link"
              onClick={() => {
                void logout();
              }}
            >
              Sign out
            </button>
            <span className="avatar">{initials}</span>
          </div>
        </header>
        <div className="dashboard">
          <WorkspaceContent active={active} navigate={setActive} />
        </div>
      </main>
      {mobileOpen && (
        <button
          className="backdrop"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </div>
  );
}
