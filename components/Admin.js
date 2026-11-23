'use client';
import { useCallback, useEffect, useState } from 'react';

const post = async (url, body) => {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Something went wrong.');
  return j;
};

function parsePeople(txt) {
  return txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const parts = (l.includes('\t') ? l.split('\t') : l.split(',')).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 1) return { name: parts[0], roll: '' };
    let [a, b] = parts;
    // Accept either "Name, Roll" or "Roll, Name": the roll number is the column with digits.
    if (/\d/.test(a) && !/\d/.test(b)) [a, b] = [b, a];
    return { name: a, roll: b };
  });
}

const practiceList = (n) =>
  Array.from({ length: n }, (_, i) => `Practice Student ${String(i + 1).padStart(3, '0')}, P${String(i + 1).padStart(3, '0')}`).join('\n');

export default function Admin() {
  const [callers, setCallers] = useState([]);
  const [names, setNames] = useState('');
  const [people, setPeople] = useState('');
  const [isPractice, setIsPractice] = useState(false);
  const [practiceN, setPracticeN] = useState(196);
  const [practiceOn, setPracticeOn] = useState(false);
  const [creds, setCreds] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/state', { cache: 'no-store' });
    if (r.status === 401) { window.location.href = '/login'; return; }
    const j = await r.json();
    setCallers(j.callers || []);
    setPracticeOn(!!j.practice);
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (key, fn) => {
    setBusy(key); setMsg('');
    try { await fn(); } catch (e) { setMsg(e.message); }
    setBusy(''); load();
  };

  const nameList = names.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const peopleList = parsePeople(people);
  const totalPeople = callers.reduce((a, c) => a + c.contacts.length, 0);
  const each = callers.length ? Math.floor(peopleList.length / callers.length) : 0;
  const credText = creds.map((c) => `${c.name} — username: ${c.username}  password: ${c.password}`).join('\n');

  return (
    <main className="band">
      <div className="topbar">
        <a className="btn small" href="/">← Back to tracker</a>
      </div>
      <h1>Setup &amp; logins</h1>
      <p className="sub">Organiser only. Add callers to create their logins, then paste the people to call and divide them evenly.</p>
      {msg && <div className="note warn" style={{ marginBottom: 14 }} role="alert">{msg}</div>}

      <section className="card">
        <h2>1. Callers and their logins</h2>
        {callers.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Name</th><th>Username</th><th style={{ textAlign: 'right' }}>People</th><th></th></tr></thead>
              <tbody>
                {callers.map((c) => (
                  <tr key={c.username}>
                    <td>{c.name}</td><td>{c.username}</td><td className="num">{c.contacts.length}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn small" type="button" disabled={!!busy} onClick={() => run('rp' + c.username, async () => {
                        if (!window.confirm(`Make a new password for ${c.name}? Their old one will stop working.`)) return;
                        const j = await post('/api/admin/reset-password', { username: c.username });
                        setCreds([j]);
                      })}>New password</button>{' '}
                      <button className="btn small danger" type="button" disabled={!!busy} onClick={() => run('rm' + c.username, async () => {
                        if (!window.confirm(`Remove ${c.name}? Their login and their list of ${c.contacts.length} people will be deleted. Divide the people again afterwards.`)) return;
                        await post('/api/admin/remove', { username: c.username });
                      })}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="hint">No callers yet.</p>}
        <div style={{ marginTop: 16 }}>
          <label htmlFor="names">Add callers — one name per line</label>
          <textarea id="names" style={{ minHeight: 140 }} value={names} onChange={(e) => setNames(e.target.value)} placeholder={'Asha Menon\nRahul Verma\nMeera Iyer'} />
          <div className="tools">
            <button className="btn primary" type="button" disabled={!nameList.length || !!busy} onClick={() => run('add', async () => {
              const j = await post('/api/admin/callers', { names: nameList });
              setCreds(j.created); setNames('');
            })}>{busy === 'add' ? 'Creating…' : `Create ${nameList.length || ''} login${nameList.length === 1 ? '' : 's'}`}</button>
            <span className="hint">Usernames come from first names; passwords are generated.</span>
          </div>
        </div>
        {creds.length > 0 && (
          <div className="creds">
            <b>Send each person their login now — passwords are only shown once.</b>
            <pre>{credText}</pre>
            <div className="tools">
              <button className="btn small" type="button" onClick={() => navigator.clipboard.writeText(credText).then(() => setMsg(''), () => {})}>Copy all</button>
              <button className="btn small" type="button" onClick={() => setCreds([])}>Done, hide these</button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>2. People to call</h2>
        <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>
          {totalPeople ? <>Right now: <b>{totalPeople} people</b> across {callers.length} callers{practiceOn ? ' — practice list' : ''}.</> : 'No list saved yet.'}
        </p>

        <div className="tools" style={{ marginTop: 0, marginBottom: 18 }}>
          <label htmlFor="pn" style={{ margin: 0 }}>Practice list size</label>
          <input id="pn" type="text" inputMode="numeric" style={{ width: 90 }} value={practiceN} onChange={(e) => setPracticeN(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          <button className="btn" type="button" disabled={!callers.length || !Number(practiceN) || !!busy} onClick={() => run('practice', async () => {
            if (totalPeople && !window.confirm('Replace the current list with a practice list?')) return;
            const list = parsePeople(practiceList(Number(practiceN)));
            const j = await post('/api/admin/distribute', { people: list, practice: true });
            window.alert(`Practice list loaded: ${j.total} made-up people divided between ${j.callers} callers.`);
          })}>{busy === 'practice' ? 'Loading…' : 'Load practice list'}</button>
          <span className="hint">Made-up names (Practice Student 001, roll P001…) so everyone can try the buttons.</span>
        </div>

        <label htmlFor="people">Name, roll number — one per line (or paste two columns from a spreadsheet, in either order)</label>
        <textarea id="people" value={people} onChange={(e) => setPeople(e.target.value)} placeholder={'Priya Sharma, 21CS045\nVikram Rao, 21CS046'} />
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500, marginTop: 10 }}>
          <input type="checkbox" checked={isPractice} onChange={(e) => setIsPractice(e.target.checked)} style={{ width: 20, height: 20 }} /> This is still a practice list
        </label>
        <div className="tools">
          <button className="btn primary" type="button" disabled={!peopleList.length || !callers.length || !!busy} onClick={() => run('dist', async () => {
            if (totalPeople && !window.confirm(`Save this list of ${peopleList.length} and divide it evenly? It replaces the current list. Anyone already marked keeps their status if their roll number is unchanged.`)) return;
            const j = await post('/api/admin/distribute', { people: peopleList, practice: isPractice });
            setPeople(''); setIsPractice(false);
            window.alert(`Saved: ${j.total} people divided between ${j.callers} callers.${j.kept ? ` ${j.kept} kept their call status.` : ''}`);
          })}>{busy === 'dist' ? 'Saving…' : 'Divide evenly & save'}</button>
          <button className="btn" type="button" disabled={!totalPeople || !!busy} onClick={() => {
            setPeople(callers.flatMap((c) => c.contacts).sort((a, b) => a.n - b.n).map((x) => (x.roll ? `${x.name}, ${x.roll}` : x.name)).join('\n'));
            setIsPractice(practiceOn);
          }}>Edit current list</button>
          <span className="hint">
            {peopleList.length ? `${peopleList.length} people` : ''}
            {peopleList.length && callers.length ? ` ÷ ${callers.length} callers = ${each}${peopleList.length % callers.length ? '–' + (each + 1) : ''} each` : ''}
            {!callers.length ? 'Add callers first.' : ''}
          </span>
        </div>
        <p className="hint">To fix a name, add or remove people: click <b>Edit current list</b>, change the lines, then save. When the real list arrives, paste it in (replacing the practice names), untick the practice box and save.</p>
      </section>

      <section className="card">
        <h2>3. New round</h2>
        <p className="hint" style={{ marginTop: 0 }}>Keeps everyone’s list but sets every person back to “yet to call” — use it before each morning’s calls.</p>
        <div className="tools">
          <button className="btn" type="button" disabled={!callers.length || !!busy} onClick={() => run('round', async () => {
            if (!window.confirm('Reset all lists to “yet to call”?')) return;
            await post('/api/admin/round');
            window.alert('New round started.');
          })}>{busy === 'round' ? 'Resetting…' : 'Start a new round'}</button>
        </div>
      </section>
    </main>
  );
}
