'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import NoveraLogo from './novera-logo';
export type RecordData = { id: number; [key: string]: string | number | null };
export type User = { id: number; name: string; email: string; role: string };
type DocumentData = { value: unknown; version: number };
type Data = { documents: Record<string, DocumentData> } & Record<
  string,
  unknown
>;
type Context = {
  data: Data;
  user: User;
  busy: boolean;
  error: string;
  refresh: () => Promise<void>;
  save: (resource: string, record: Partial<RecordData>) => Promise<RecordData>;
  remove: (resource: string, id: number) => Promise<void>;
  saveDocument: (key: string, value: unknown) => Promise<void>;
  logout: () => Promise<void>;
};
const CrmContext = createContext<Context | null>(null);
export function useCrm() {
  const context = useContext(CrmContext);
  if (!context) throw Error('CRM data provider missing');
  return context;
}
export function useRecords(resource: string) {
  const { data } = useCrm();
  return (data[resource] || []) as RecordData[];
}
export function CrmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ data: Data; user: User } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('crm_session');
          sessionStorage.removeItem('novera_crm_cache');
        }
        router.replace('/login');
      }
      setError(error instanceof Error ? error.message : 'Unable to connect.');
    },
    [router],
  );
  const refresh = useCallback(async () => {
    try {
      const result = await api<{ data: Data; user: User }>('/bootstrap');
      setState(result);
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('novera_crm_cache', JSON.stringify(result));
        } catch {}
      }
      setError('');
    } catch (error) {
      handleError(error);
    }
  }, [handleError]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const cached = sessionStorage.getItem('novera_crm_cache');
        if (cached) setState(JSON.parse(cached));
      } catch {}
    });
    api<{ data: Data; user: User }>('/bootstrap')
      .then((result) => {
        if (active) {
          setState(result);
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem('novera_crm_cache', JSON.stringify(result));
            } catch {}
          }
          setError('');
        }
      })
      .catch((error) => {
        if (active) handleError(error);
      });
    return () => {
      active = false;
    };
  }, [handleError]);
  const save = async (resource: string, record: Partial<RecordData>) => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api<{ data: RecordData }>(
        `/${resource}${record.id ? `/${record.id}` : ''}`,
        { method: record.id ? 'PATCH' : 'POST', body: JSON.stringify(record) },
      );
      setState((previous) => {
        if (!previous) return previous;
        const rows = (previous.data[resource] || []) as RecordData[];
        return {
          ...previous,
          data: {
            ...previous.data,
            [resource]: record.id
              ? rows.map((row) => (row.id === data.id ? data : row))
              : [...rows, data],
          },
        };
      });
      return data;
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };
  const remove = async (resource: string, id: number) => {
    setBusy(true);
    setError('');
    try {
      await api(`/${resource}/${id}`, { method: 'DELETE' });
      setState((previous) => {
        if (!previous) return previous;
        const rows = (previous.data[resource] || []) as RecordData[];
        return {
          ...previous,
          data: {
            ...previous.data,
            [resource]: rows.filter((row) => row.id !== id),
          },
        };
      });
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };
  const saveDocument = async (key: string, value: unknown) => {
    setBusy(true);
    setError('');
    try {
      const document = state?.data.documents[key];
      const result = await api<DocumentData>(`/documents/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value, version: document?.version || 0 }),
      });
      setState((previous) =>
        previous
          ? {
              ...previous,
              data: {
                ...previous.data,
                documents: { ...previous.data.documents, [key]: result },
              },
            }
          : previous,
      );
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('crm_session');
      sessionStorage.removeItem('novera_crm_cache');
    }
    try {
      await api('/auth/logout', { method: 'POST' });
      setState(null);
      router.replace('/login');
    } catch (error) {
      handleError(error);
    }
  };
  if (!state)
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#0e1326',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          gap: 16,
        }}
      >
        {error ? (
          <div style={{ textAlign: 'center', maxWidth: 400, padding: 24, background: '#1c223a', borderRadius: 12 }}>
            <p style={{ color: '#ff6b81', marginBottom: 16, fontSize: 15 }}>{error}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => void refresh()}
                style={{
                  background: '#6366f1',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Retry connection
              </button>
              <Link
                href="/login"
                style={{
                  color: '#94a3b8',
                  textDecoration: 'none',
                  padding: '8px 16px',
                  border: '1px solid #334155',
                  borderRadius: 6,
                }}
              >
                Sign in
              </Link>
            </div>
          </div>
        ) : (
          <output className="crm-initial-loader" aria-live="polite">
            <span className="crm-initial-loader-mark" aria-hidden="true">
              <span className="crm-initial-loader-glow" />
              <NoveraLogo />
            </span>
            <strong>NOVERA CRM</strong>
            <span className="crm-initial-loader-status">
              Connecting to your workspace
              <span className="crm-initial-loader-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </span>
          </output>
        )}
      </div>
    );
  return (
    <CrmContext.Provider
      value={{ ...state, busy, error, refresh, save, remove, saveDocument, logout }}
    >
      {error && (
        <div
          role="alert"
          style={{
            background: '#fff0f1',
            color: '#a42b46',
            padding: 14,
            position: 'sticky',
            top: 0,
            zIndex: 80,
          }}
        >
          {error} <button onClick={() => void refresh()}>Reload data</button>
        </div>
      )}
      {busy && (
        <output
          style={{
            position: 'fixed',
            bottom: 15,
            right: 20,
            zIndex: 90,
            background: '#19213d',
            color: 'white',
            padding: '8px 16px',
            borderRadius: 8,
          }}
        >
          Saving…
        </output>
      )}
      {children}
    </CrmContext.Provider>
  );
}
export function text(row: RecordData, key: string) {
  return String(row[key] ?? '');
}
export function money(value: unknown) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}
export function dateLabel(value: unknown) {
  if (typeof value !== 'string' || !value) return '—';
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(
    'en-GB',
    { day: '2-digit', month: 'short', year: 'numeric' },
  );
}
