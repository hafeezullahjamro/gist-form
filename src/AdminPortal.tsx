import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  BookOpenCheck, Download, Eye, LockKeyhole, LogOut,
  RefreshCw, Search, ShieldCheck, UsersRound,
} from 'lucide-react';

type DashboardData = { headers: string[]; rows: string[][] };

async function readJson(response: Response) {
  const text = await response.text();
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('The admin API is available through Netlify Dev or the deployed Netlify site.');
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error('The server returned an unreadable response.');
  }
}

export default function AdminPortal({ onExit }: { onExit: () => void }) {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<DashboardData>({ headers: [], rows: [] });
  const [query, setQuery] = useState('');

  const loadData = async () => {
    setLoadingData(true);
    setError('');
    try {
      const response = await fetch('/api/admin/data', { credentials: 'same-origin', cache: 'no-store' });
      const result = await readJson(response);
      if (!response.ok) {
        if (response.status === 401) setAuthenticated(false);
        throw new Error(typeof result.message === 'string' ? result.message : 'Could not load registrations.');
      }
      if (!Array.isArray(result.headers) || !Array.isArray(result.rows)) throw new Error('The dashboard data format is invalid.');
      setData({ headers: result.headers as string[], rows: result.rows as string[][] });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load registrations.');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    const check = async () => {
      try {
        const response = await fetch('/api/admin/session', { credentials: 'same-origin', cache: 'no-store' });
        const result = await readJson(response);
        const active = response.ok && result.authenticated === true;
        setAuthenticated(active);
        if (active) await loadData();
      } catch (checkError) {
        setError(checkError instanceof Error ? checkError.message : 'Admin login is unavailable.');
      } finally {
        setChecking(false);
      }
    };
    void check();
  }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(typeof result.message === 'string' ? result.message : 'Sign-in failed.');
      setPassword('');
      setAuthenticated(true);
      await loadData();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/admin/session', { method: 'DELETE', credentials: 'same-origin' });
    } finally {
      setAuthenticated(false);
      setData({ headers: [], rows: [] });
      setUsername('');
      setPassword('');
      setError('');
    }
  };

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return data.rows;
    return data.rows.filter(row => row.some(value => value.toLocaleLowerCase().includes(normalized)));
  }, [data.rows, query]);

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = data.rows.filter(row => row[0]?.startsWith(today)).length;
  const receiptColumn = data.headers.indexOf('Payment Receipt Blob Key');
  const receiptCount = receiptColumn >= 0 ? data.rows.filter(row => Boolean(row[receiptColumn])).length : 0;

  if (checking) {
    return <main className="container admin-shell"><div className="admin-loading"><span className="spinner" />Checking secure session…</div></main>;
  }

  if (!authenticated) {
    return (
      <main className="container admin-shell admin-shell--login">
        <section className="admin-login-card" aria-label="Administrator sign in">
          <div className="admin-lock"><LockKeyhole size={28} /></div>
          <span className="admin-kicker">PRIVATE ACCESS</span>
          <h1>Registration dashboard</h1>
          <p>Sign in to view applicants, download receipts and export the registration data.</p>
          <form onSubmit={login}>
            <label htmlFor="adminUsername">Username</label>
            <input id="adminUsername" className="control" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" required />
            <label htmlFor="adminPassword">Password</label>
            <input id="adminPassword" className="control" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required />
            {error && <div className="admin-error" role="alert">{error}</div>}
            <button className="primary-button admin-login-button" type="submit" disabled={submitting}>
              {submitting ? <><span className="spinner" />Signing in…</> : <><ShieldCheck size={18} />Sign in securely</>}
            </button>
          </form>
          <button className="admin-return" type="button" onClick={onExit}>Return to public website</button>
          <div className="admin-security-note"><LockKeyhole size={14} />Credentials are checked only by the server.</div>
        </section>
      </main>
    );
  }

  return (
    <main className="container admin-shell">
      <section className="admin-heading">
        <div><span className="admin-kicker">GIST ADMINISTRATION</span><h1>Scholarship registrations</h1><p>Private applicant records and payment receipt access.</p></div>
        <div className="admin-heading-actions">
          <button type="button" onClick={() => void loadData()} disabled={loadingData}><RefreshCw size={16} className={loadingData ? 'spin-icon' : ''} />Refresh</button>
          <button type="button" onClick={() => void logout()}><LogOut size={16} />Sign out</button>
        </div>
      </section>

      <section className="admin-stats" aria-label="Registration summary">
        <article><span><UsersRound size={19} /></span><div><strong>{data.rows.length}</strong><small>Total registrations</small></div></article>
        <article><span><BookOpenCheck size={19} /></span><div><strong>{todayCount}</strong><small>Received today</small></div></article>
        <article><span><ShieldCheck size={19} /></span><div><strong>{receiptCount}</strong><small>Receipts stored</small></div></article>
      </section>

      <section className="admin-data-card">
        <div className="admin-toolbar">
          <label className="admin-search" htmlFor="adminSearch"><Search size={17} /><input id="adminSearch" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, phone, course or ID" /></label>
          <a className="admin-export" href="/api/admin/data?format=csv" download><Download size={17} />Export for Excel</a>
        </div>
        {error && <div className="admin-error admin-error--wide" role="alert">{error}</div>}
        <div className="admin-result-count">Showing {filteredRows.length} of {data.rows.length} registrations</div>
        <div className="admin-table-wrap">
          <table>
            <thead><tr>{data.headers.map(header => <th key={header}>{header}</th>)}</tr></thead>
            <tbody>
              {filteredRows.map((row, rowIndex) => (
                <tr key={row[1] || rowIndex}>
                  {data.headers.map((header, columnIndex) => (
                    <td key={header}>
                      {header === 'Payment Receipt Blob Key' && row[columnIndex]
                        ? <a className="receipt-view" href={`/api/admin/receipt?key=${encodeURIComponent(row[columnIndex])}`} target="_blank" rel="noreferrer"><Eye size={15} />View receipt</a>
                        : row[columnIndex] || <span className="empty-cell">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
              {!filteredRows.length && <tr><td className="admin-empty" colSpan={Math.max(data.headers.length, 1)}>No matching registrations found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
