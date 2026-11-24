'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

const count = (list) => {
  const r = { ok: 0, np: 0, cb: 0, todo: 0, total: list.length };
  for (const x of list) x.status === 'ok' ? r.ok++ : x.status === 'np' ? r.np++ : x.status === 'cb' ? r.cb++ : r.todo++;
  return r;
};
// "05:30" -> "5:30 AM"
const clock = (hm) => {
  if (!hm) return '';
  const [h, m] = hm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};
const nowHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const mins = (hm) => { const [h, m] = String(hm).split(':').map(Number); return h * 60 + m; };
// Minutes since the call-back time, within the last 12 hours (so a 6 AM call-back set at 11 PM isn't "due" yet); otherwise null.
const overdueBy = (hm, now) => { const d = (mins(now) - mins(hm) + 1440) % 1440; return d < 720 ? d : null; };
// Sort key: overdue first (most overdue at the top), then soonest upcoming.
const cbOrder = (hm, now) => { const o = overdueBy(hm, now); return o !== null ? -o : (mins(hm) - mins(now) + 1440) % 1440; };
const pct = (a, b) => (b ? (a / b) * 100 + '%' : '0%');
const time = (t) => (t ? new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');

function Bar({ t, big }) {
  return (
    <div className={big ? 'dawn' : 'mini'} role="img" aria-label={`${t.ok} called, ${t.cb} to call back, ${t.np} not picked, ${t.todo} yet to call`}>
      <i className="seg-ok" style={{ width: pct(t.ok, t.total) }} />
      <i className="seg-cb" style={{ width: pct(t.cb, t.total) }} />
      <i className="seg-np" style={{ width: pct(t.np, t.total) }} />
    </div>
  );
}

export default function Dashboard({ me }) {
  const [callers, setCallers] = useState(null);
  const [practice, setPractice] = useState(false);
  const [view, setView] = useState(me.role === 'caller' ? me.username : 'team');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [pwOpen, setPwOpen] = useState(false);
  const pending = useRef(0);

  const flash = (t) => { setToast(t); clearTimeout(flash.t); flash.t = setTimeout(() => setToast(''), 2200); };

  const load = useCallback(async () => {
    if (pending.current) return; // don't overwrite an optimistic update in flight
    try {
      const r = await fetch('/api/state', { cache: 'no-store' });
      if (r.status === 401) { window.location.href = '/login'; return; }
      if (!r.ok) throw new Error();
      const j = await r.json();
      if (!pending.current) { setCallers(j.callers); setPractice(!!j.practice); }
      setError('');
    } catch { setError('Can’t reach the server — showing the last data loaded.'); }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 8000);
    const onVis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  async function mark(caller, c, status, extra = {}) {
    const optimistic =
      status === 'todo' ? { status: 'todo', at: null, tries: 0, cbTime: null, cbNote: null }
      : status === 'cb' ? { status: 'cb', at: Date.now(), ...extra }
      : { status, at: Date.now(), tries: status === 'np' ? (c.tries || 0) + 1 : c.tries || 0 };
    setCallers((cs) => cs.map((x) => (x.username !== caller ? x : { ...x, contacts: x.contacts.map((y) => (y.key === c.key ? { ...y, ...optimistic } : y)) })));
    pending.current++;
    try {
      const r = await fetch('/api/mark', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ caller, key: c.key, status, ...extra }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { window.location.href = '/login'; return; }
      if (!r.ok) throw new Error(j.error);
      flash(status === 'ok' ? `${c.name}: called` : status === 'np' ? `${c.name}: not picked` : status === 'cb' ? `${c.name}: call back at ${clock(extra.cbTime)}` : `${c.name}: back to yet to call`);
    } catch (e) {
      flash(e.message || 'Couldn’t save — try again');
    } finally {
      pending.current--;
      load();
    }
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const all = (callers || []).flatMap((c) => c.contacts);
  const t = count(all);
  const current = view !== 'team' && callers ? callers.find((c) => c.username === view) : null;
  const canMark = (c) => me.role === 'admin' || c.username === me.username;

  return (
    <>
      <header className="band" style={{ paddingBottom: 12 }}>
        <div className="topbar">
          <span>Signed in as <b>{me.name}</b>{me.role === 'admin' ? ' (organiser)' : ` · ${me.username}`}</span>
          <span className="links">
            {me.role === 'admin' && <a className="btn small" href="/admin">Setup &amp; logins</a>}
            {me.role === 'caller' && <button className="btn small" type="button" onClick={() => setPwOpen(true)}>Change password</button>}
            <button className="btn small" type="button" onClick={logout}>Log out</button>
          </span>
        </div>
        <h1>Wake-up call tracker</h1>
        <p className="sub">{callers ? (callers.length ? `${callers.length} callers · ${t.total} people to wake up` : 'No lists yet') : 'Loading…'}</p>
        <Bar t={t} big />
        <div className="totals">
          <div className="tot ok"><span className="big">{t.ok}</span><span>Called</span></div>
          <div className="tot cb"><span className="big">{t.cb}</span><span>Call back</span></div>
          <div className="tot np"><span className="big">{t.np}</span><span>Not picked</span></div>
          <div className="tot"><span className="big">{t.todo}</span><span>Yet to call</span></div>
          <div className="tot"><span className="big">{t.total ? Math.round((t.ok / t.total) * 100) : 0}%</span><span>Done</span></div>
        </div>
        <nav>
          {me.role === 'caller' && (
            <button className={`btn${view === me.username ? ' on' : ''}`} type="button" onClick={() => { setView(me.username); setFilter('all'); }}>My list</button>
          )}
          <button className={`btn${view === 'team' ? ' on' : ''}`} type="button" onClick={() => setView('team')}>Team progress</button>
          <select aria-label="Open a caller's list" value={view !== 'team' && view !== me.username ? view : ''} onChange={(e) => { setView(e.target.value || 'team'); setFilter('all'); }}>
            <option value="">See someone’s list…</option>
            {(callers || []).filter((c) => c.username !== me.username).map((c) => <option key={c.username} value={c.username}>{c.name}</option>)}
          </select>
        </nav>
      </header>

      <main className="band" style={{ paddingTop: 8 }}>
        {error && <div className="note warn" style={{ marginBottom: 12 }}>{error}</div>}
        {practice && <div className="note practice" style={{ marginBottom: 12 }}><b>Practice list.</b> These are made-up names for trying out the buttons. The real list will replace them soon.</div>}
        {!callers ? null : view === 'team' || !current ? (
          callers.length ? (
            <>
              <h2>Team progress</h2>
              <div className="board">
                {callers.map((c) => {
                  const ct = count(c.contacts);
                  return (
                    <button key={c.username} className="row" type="button" onClick={() => { setView(c.username); setFilter('all'); }}>
                      <b>{c.name}{c.username === me.username && <span className="tag">me</span>}</b>
                      <Bar t={ct} />
                      <span className="nums"><em className="o">{ct.ok}</em> called · {ct.cb > 0 && <><em className="b">{ct.cb}</em> call back · </>}<em className="n">{ct.np}</em> not picked · <em>{ct.todo}</em> to call</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="note">{me.role === 'admin' ? <>No callers yet. Open <a href="/admin">Setup &amp; logins</a> to add them.</> : 'The organiser hasn’t set up the call lists yet.'}</div>
          )
        ) : (
          <CallerList c={current} me={me} filter={filter} setFilter={setFilter} editable={canMark(current)} mark={mark} />
        )}
      </main>
      {pwOpen && <PasswordModal close={() => setPwOpen(false)} flash={flash} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

function CallerList({ c, me, filter, setFilter, editable, mark }) {
  const [cbFor, setCbFor] = useState(null);
  const [cbTime, setCbTime] = useState('');
  const [cbNote, setCbNote] = useState('');
  const [now, setNow] = useState(nowHM());
  useEffect(() => { const id = setInterval(() => setNow(nowHM()), 30000); return () => clearInterval(id); }, []);
  const t = count(c.contacts);
  let shown = c.contacts.filter((x) => filter === 'all' || (filter === 'todo' ? !['ok', 'np', 'cb'].includes(x.status) : x.status === filter));
  if (filter === 'cb') shown = [...shown].sort((a, b) => cbOrder(a.cbTime, now) - cbOrder(b.cbTime, now));
  const F = ({ k, l, n }) => <button className={`btn${filter === k ? ' on' : ''}`} type="button" onClick={() => setFilter(k)}>{l} ({n})</button>;
  const openCb = (x) => { setCbFor(cbFor === x.key ? null : x.key); setCbTime(x.cbTime || ''); setCbNote(x.cbNote || ''); };
  return (
    <>
      <h2>{c.username === me.username ? 'My list' : `${c.name}’s list`}</h2>
      <div style={{ marginBottom: 14 }}><Bar t={t} /></div>
      <div className="filters">
        <F k="all" l="All" n={t.total} /><F k="todo" l="Yet to call" n={t.todo} /><F k="cb" l="Call back" n={t.cb} /><F k="np" l="Not picked" n={t.np} /><F k="ok" l="Called" n={t.ok} />
      </div>
      {!editable && <p className="hint" style={{ marginBottom: 10 }}>You’re viewing {c.name}’s list. Only {c.name} (or the organiser) can mark these.</p>}
      <div className="list">
        {shown.length ? shown.map((x) => {
          const st = ['ok', 'np', 'cb'].includes(x.status) ? x.status : '';
          const due = st === 'cb' && x.cbTime && overdueBy(x.cbTime, now) !== null;
          return (
            <div key={x.key} className={`c ${st}${due ? ' due' : ''}`}>
              <div>
                <span className="nm">{x.name}</span>
                {st === 'ok' && <span className="badge ok">Called {time(x.at)}</span>}
                {st === 'np' && <span className="badge np">Not picked{x.tries > 1 ? ` ×${x.tries}` : ''} {time(x.at)}</span>}
                {st === 'cb' && <span className="badge cb">{due ? 'Call back now' : 'Call back'} at {clock(x.cbTime)}</span>}
                <div className="ph">{x.roll ? `Roll no. ${x.roll}` : 'No roll number'}</div>
                {st === 'cb' && x.cbNote && <div className="cbnote">“{x.cbNote}”</div>}
                {st !== 'cb' && x.cbTime && <div className="cbnote">Had asked for a call back at {clock(x.cbTime)}</div>}
              </div>
              {editable && (
                <div className="acts">
                  {st !== 'ok' && <button className="btn b-ok" type="button" onClick={() => mark(c.username, x, 'ok')}>{st === 'cb' ? 'Called back' : 'Called'}</button>}
                  <button className="btn b-cb" type="button" aria-expanded={cbFor === x.key} onClick={() => openCb(x)}>{st === 'cb' ? 'Change time' : 'Call back'}</button>
                  <button className="btn b-np" type="button" onClick={() => mark(c.username, x, 'np')}>{st === 'np' ? 'Not picked again' : 'Not picked'}</button>
                  {st && <button className="btn b-undo" type="button" onClick={() => mark(c.username, x, 'todo')}>Undo</button>}
                </div>
              )}
              {editable && cbFor === x.key && (
                <form className="cbform" onSubmit={(e) => { e.preventDefault(); if (!cbTime) return; mark(c.username, x, 'cb', { cbTime, cbNote: cbNote.trim() }); setCbFor(null); }}>
                  <div><label htmlFor={'cbt-' + x.key}>Call {x.name.split(' ')[0]} back at</label><input id={'cbt-' + x.key} type="time" required value={cbTime} onChange={(e) => setCbTime(e.target.value)} /></div>
                  <div className="grow"><label htmlFor={'cbn-' + x.key}>Note (optional)</label><input id={'cbn-' + x.key} type="text" maxLength={140} value={cbNote} onChange={(e) => setCbNote(e.target.value)} placeholder="e.g. call on the other number" /></div>
                  <div className="tools" style={{ margin: 0 }}><button className="btn primary" type="submit" disabled={!cbTime}>Save</button><button className="btn" type="button" onClick={() => setCbFor(null)}>Cancel</button></div>
                </form>
              )}
            </div>
          );
        }) : <div className="note">{c.contacts.length ? 'Nobody in this group.' : 'No one assigned to this list yet.'}</div>}
      </div>
    </>
  );
}

function PasswordModal({ close, flash }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault();
    const r = await fetch('/api/password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ current: cur, next }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error || 'Couldn’t change the password.');
    flash('Password changed'); close();
  }
  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && close()}>
      <form className="box" onSubmit={submit}>
        <h2 style={{ margin: 0 }}>Change password</h2>
        <div><label htmlFor="cp">Current password</label><input id="cp" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></div>
        <div><label htmlFor="np">New password (4+ characters)</label><input id="np" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} minLength={4} required /></div>
        {err && <p className="err" role="alert">{err}</p>}
        <div className="tools" style={{ margin: 0 }}><button className="btn primary" type="submit">Save</button><button className="btn" type="button" onClick={close}>Cancel</button></div>
      </form>
    </div>
  );
}
