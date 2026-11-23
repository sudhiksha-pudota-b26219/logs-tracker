'use client';
import { useState } from 'react';

export default function Login() {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const r = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
    if (r.ok) { window.location.href = '/'; return; }
    const j = await r.json().catch(() => ({}));
    setErr(j.error || 'Could not log in.'); setBusy(false);
  }
  return (
    <main className="login">
      <h1>Wake-up calls</h1>
      <p className="sub">Log in with the username and password you were given.</p>
      <form onSubmit={submit}>
        <div><label htmlFor="u">Username</label><input id="u" type="text" autoComplete="username" autoCapitalize="none" value={u} onChange={(e) => setU(e.target.value)} required /></div>
        <div><label htmlFor="p">Password</label><input id="p" type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} required /></div>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
    </main>
  );
}
