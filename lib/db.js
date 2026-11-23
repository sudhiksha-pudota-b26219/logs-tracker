import { neon } from '@neondatabase/serverless';

// Vercel's Neon integration sets DATABASE_URL (and POSTGRES_URL).
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

// ---------- Postgres (production) ----------
function pgStore() {
  const sql = neon(url);
  let ready;
  const init = () =>
    (ready ||= sql.transaction([
      sql`CREATE TABLE IF NOT EXISTS users (username text PRIMARY KEY, data jsonb NOT NULL)`,
      sql`CREATE TABLE IF NOT EXISTS contacts (caller text NOT NULL, key text NOT NULL, data jsonb NOT NULL, PRIMARY KEY (caller, key))`,
      sql`CREATE TABLE IF NOT EXISTS meta (k text PRIMARY KEY, v text)`,
    ]).catch((e) => { ready = null; throw e; }));
  const q = async (text, params = []) => { await init(); return sql.query(text, params); };
  const upsertContacts = `INSERT INTO contacts (caller, key, data)
    SELECT $1, e.key, e.value FROM jsonb_each($2::jsonb) e
    ON CONFLICT (caller, key) DO UPDATE SET data = EXCLUDED.data`;
  return {
    async getUsers() {
      const rows = await q('SELECT username, data FROM users');
      return Object.fromEntries(rows.map((r) => [r.username, r.data]));
    },
    async getUser(u) {
      const rows = await q('SELECT data FROM users WHERE username = $1', [u]);
      return rows[0]?.data || null;
    },
    async saveUser(u) {
      await q('INSERT INTO users (username, data) VALUES ($1, $2::jsonb) ON CONFLICT (username) DO UPDATE SET data = EXCLUDED.data', [u.username, JSON.stringify(u)]);
    },
    async removeUser(u) {
      await init();
      await sql.transaction([sql`DELETE FROM users WHERE username = ${u}`, sql`DELETE FROM contacts WHERE caller = ${u}`]);
    },
    async getAllLists() {
      const rows = await q('SELECT caller, key, data FROM contacts');
      const out = {};
      for (const r of rows) (out[r.caller] ||= {})[r.key] = r.data;
      return out;
    },
    async getList(u) {
      const rows = await q('SELECT key, data FROM contacts WHERE caller = $1', [u]);
      return Object.fromEntries(rows.map((r) => [r.key, r.data]));
    },
    async getContact(u, key) {
      const rows = await q('SELECT data FROM contacts WHERE caller = $1 AND key = $2', [u, key]);
      return rows[0]?.data || null;
    },
    async saveContacts(u, contacts) {
      if (!Object.keys(contacts).length) return;
      await q(upsertContacts, [u, JSON.stringify(contacts)]);
    },
    async replaceList(u, contacts) {
      await init();
      await sql.transaction([
        sql`DELETE FROM contacts WHERE caller = ${u}`,
        sql.query(upsertContacts, [u, JSON.stringify(contacts)]),
      ]);
    },
    async getMeta() {
      const rows = await q('SELECT k, v FROM meta');
      return Object.fromEntries(rows.map((r) => [r.k, r.v]));
    },
    async setMeta(obj) {
      for (const [k, v] of Object.entries(obj))
        await q('INSERT INTO meta (k, v) VALUES ($1, $2) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v', [k, String(v)]);
    },
  };
}

// ---------- In-memory (local development only; lost on restart) ----------
function memStore() {
  const g = (globalThis.__wkMem ||= { users: {}, lists: {}, meta: {} });
  const clone = (x) => JSON.parse(JSON.stringify(x));
  return {
    async getUsers() { return clone(g.users); },
    async getUser(u) { return g.users[u] ? clone(g.users[u]) : null; },
    async saveUser(u) { g.users[u.username] = clone(u); },
    async removeUser(u) { delete g.users[u]; delete g.lists[u]; },
    async getAllLists() { return clone(g.lists); },
    async getList(u) { return clone(g.lists[u] || {}); },
    async getContact(u, k) { return g.lists[u]?.[k] ? clone(g.lists[u][k]) : null; },
    async saveContacts(u, c) { g.lists[u] = { ...(g.lists[u] || {}), ...clone(c) }; },
    async replaceList(u, c) { g.lists[u] = clone(c); },
    async getMeta() { return { ...g.meta }; },
    async setMeta(o) { for (const [k, v] of Object.entries(o)) g.meta[k] = String(v); },
  };
}

let store;
function db() {
  if (store) return store;
  if (url) store = pgStore();
  else if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_MEMORY_STORE === '1') store = memStore();
  else throw new Error('Database not configured: connect Neon Postgres to this Vercel project.');
  return store;
}

export const getUsers = () => db().getUsers();
export const getUser = (u) => db().getUser(u);
export const saveUser = (u) => db().saveUser(u);
export const removeUser = (u) => db().removeUser(u);
export const getAllLists = () => db().getAllLists();
export const getList = (u) => db().getList(u);
export const getContact = (u, k) => db().getContact(u, k);
export const saveContacts = (u, c) => db().saveContacts(u, c);
export const replaceList = (u, c) => db().replaceList(u, c);
export const getMeta = () => db().getMeta();
export const setMeta = (o) => db().setMeta(o);

export async function getCallers() {
  const users = await getUsers();
  return Object.values(users).filter((u) => u.role === 'caller').sort((a, b) => a.order - b.order);
}
