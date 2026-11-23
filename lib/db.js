import { Redis } from '@upstash/redis';

// Vercel's Upstash integration sets KV_REST_API_*; a direct Upstash setup uses UPSTASH_REDIS_REST_*.
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

function memoryStore() {
  // Local development only: data lives in memory and is lost on restart.
  const g = globalThis;
  if (!g.__wkMem) g.__wkMem = new Map();
  const m = g.__wkMem;
  const h = (k) => { if (!m.has(k)) m.set(k, new Map()); return m.get(k); };
  return {
    async hgetall(k) { const x = m.get(k); return x && x.size ? Object.fromEntries(x) : null; },
    async hget(k, f) { const x = m.get(k); return x?.has(f) ? x.get(f) : null; },
    async hset(k, obj) { const x = h(k); for (const [f, v] of Object.entries(obj)) x.set(f, v); return 1; },
    async hdel(k, ...fs) { const x = m.get(k); if (x) fs.forEach((f) => x.delete(f)); return 1; },
    async del(k) { m.delete(k); return 1; },
  };
}

let store;
export function db() {
  if (store) return store;
  if (url && token) store = new Redis({ url, token, automaticDeserialization: false });
  else if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_MEMORY_STORE === '1') store = memoryStore();
  else throw new Error('Database not configured: connect Upstash Redis to this Vercel project.');
  return store;
}

const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const parseAll = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, parse(v)]));

export async function getUsers() {
  return parseAll(await db().hgetall('users'));
}
export async function getUser(username) {
  const v = await db().hget('users', username);
  return v ? parse(v) : null;
}
export async function saveUser(u) {
  await db().hset('users', { [u.username]: JSON.stringify(u) });
}
export async function removeUser(username) {
  await db().hdel('users', username);
  await db().del('list:' + username);
}
export async function getList(username) {
  return parseAll(await db().hgetall('list:' + username));
}
export async function getContact(username, key) {
  const v = await db().hget('list:' + username, key);
  return v ? parse(v) : null;
}
export async function saveContacts(username, contacts) {
  const entries = Object.entries(contacts);
  if (!entries.length) return;
  await db().hset('list:' + username, Object.fromEntries(entries.map(([k, v]) => [k, JSON.stringify(v)])));
}
export async function replaceList(username, contacts) {
  await db().del('list:' + username);
  await saveContacts(username, contacts);
}

export async function getCallers() {
  const users = await getUsers();
  return Object.values(users).filter((u) => u.role === 'caller').sort((a, b) => a.order - b.order);
}

export async function getMeta() {
  return (await db().hgetall('meta')) || {};
}
export async function setMeta(obj) {
  await db().hset('meta', obj);
}
