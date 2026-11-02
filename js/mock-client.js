// A small in-browser stand-in for the supabase-js calls the pages use.
// Data lives in localStorage, and the same rules as the database policies (ARCHITECTURE 3.4)
// are applied here, so a blocked action behaves like it will with the real backend.
import { todayIsrael, isWindowOpen, isCounted } from '../lib/rules.js';
import { buildSeed, DEMO_VERSION } from './mock-data.js';

const DB_KEY = 'flexication.demo.db';
const USER_KEY = 'flexication.demo.user';

const memory = {};
function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    if (value === undefined) return memory[key] ?? null;
    if (value === null) delete memory[key];
    else memory[key] = value;
  }
  return null;
}

function load() {
  let db = null;
  try {
    db = JSON.parse(store(DB_KEY));
  } catch {
    db = null;
  }
  if (!db || db.version !== DEMO_VERSION) db = buildSeed(todayIsrael());
  return db;
}
const save = (db) => store(DB_KEY, JSON.stringify(db));

export function resetDemo() {
  store(DB_KEY, null);
  store(USER_KEY, null);
}

// Every employee, for the demo sign-in list (not subject to the read rules).
export function listDemoUsers() {
  return load().employees;
}

function currentUser(db) {
  const email = store(USER_KEY);
  if (!email) return null;
  return db.employees.find((e) => e.email === email) || null;
}

function pick(obj, cols) {
  if (!cols.length || cols.includes('*')) return { ...obj };
  const out = {};
  for (const c of cols) if (c in obj) out[c] = obj[c];
  return out;
}

function canRead(table, row, user) {
  if (!user) return false;
  if (table === 'windows') return true;
  if (user.role === 'hr') return true;
  if (table === 'employees') return row.email === user.email;
  return (
    row.employee_email === user.email ||
    (user.role === 'manager' && row.manager_email === user.email)
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const err = (message) => ({ data: null, error: { message } });

class Query {
  constructor(table) {
    this.table = table;
    this.op = 'select';
    this.cols = '*';
    this.filters = [];
    this.orderBy = null;
    this.mode = 'many';
    this.returning = false;
    this.payload = null;
    this.options = {};
  }

  select(cols = '*') {
    if (this.op === 'select') this.cols = cols;
    else {
      this.returning = true;
      this.cols = cols;
    }
    return this;
  }
  insert(rows) {
    this.op = 'insert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  update(patch) {
    this.op = 'update';
    this.payload = patch;
    return this;
  }
  upsert(rows, options = {}) {
    this.op = 'upsert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.options = options;
    return this;
  }
  eq(col, value) {
    this.filters.push([col, value]);
    return this;
  }
  order(col, { ascending = true } = {}) {
    this.orderBy = { col, ascending };
    return this;
  }
  maybeSingle() {
    this.mode = 'maybe';
    return this;
  }
  single() {
    this.mode = 'single';
    return this;
  }
  then(resolve, reject) {
    return Promise.resolve().then(() => this.exec()).then(resolve, reject);
  }

  project(rows, db) {
    const joins = [];
    const base = this.cols.replace(/(\w+)(!inner)?\(([^)]*)\)/g, (m, name, inner, sub) => {
      joins.push({ name, inner: !!inner, cols: sub.split(',').map((s) => s.trim()) });
      return '';
    });
    const baseCols = base.split(',').map((s) => s.trim()).filter(Boolean);
    const out = [];
    for (const row of rows) {
      const obj = pick(row, baseCols);
      let keep = true;
      for (const j of joins) {
        const related = j.name === 'windows' ? db.windows.find((w) => w.id === row.window_id) : null;
        if (!related && j.inner) keep = false;
        obj[j.name] = related ? pick(related, j.cols) : null;
      }
      if (keep) out.push(obj);
    }
    return out;
  }

  shape(rows, db) {
    const projected = this.project(rows, db);
    if (this.mode === 'many') return { data: projected, error: null };
    if (projected.length === 0) {
      return this.mode === 'maybe' ? { data: null, error: null } : err('No rows found.');
    }
    return { data: projected[0], error: null };
  }

  exec() {
    const db = load();
    const user = currentUser(db);
    const today = todayIsrael();
    const t = this.table;
    if (!db[t]) return err(`Unknown table ${t}.`);

    if (this.op === 'select') {
      let rows = db[t].filter((r) => canRead(t, r, user));
      for (const [c, v] of this.filters) if (!c.includes('.')) rows = rows.filter((r) => r[c] === v);
      if (this.orderBy) {
        const { col, ascending } = this.orderBy;
        rows = [...rows].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (ascending ? 1 : -1));
      }
      return this.shape(rows, db);
    }

    if (!user) return err('You must be signed in.');

    if (this.op === 'insert') return this.insertRows(db, user, today);
    if (this.op === 'upsert') return this.upsertEmployees(db, user);
    if (this.op === 'update') return this.updateRequests(db, user, today);
    return err('Not supported in the demo.');
  }

  done(db, rows) {
    save(db);
    return this.returning ? this.shape(rows, db) : { data: null, error: null };
  }

  insertRows(db, user, today) {
    const created = [];
    for (const r of this.payload) {
      if (this.table === 'windows') {
        if (user.role !== 'hr') return err('Only HR can open windows.');
        if (!['buy', 'sell'].includes(r.type)) return err('Window type must be buy or sell.');
        if (!r.start_date || !r.end_date || r.end_date < r.start_date) return err('The end date cannot be before the start date.');
        const row = {
          id: Math.max(0, ...db.windows.map((w) => w.id)) + 1,
          type: r.type,
          start_date: r.start_date,
          end_date: r.end_date,
          window_year: Number(r.start_date.slice(0, 4)),
          created_at: new Date().toISOString(),
        };
        db.windows.push(row);
        created.push(row);
      } else if (this.table === 'requests') {
        const result = this.checkNewRequest(db, user, today, r);
        if (result.error) return result;
        db.requests.push(result.row);
        created.push(result.row);
      } else {
        return err('Not supported in the demo.');
      }
    }
    return this.done(db, created);
  }

  checkNewRequest(db, user, today, r) {
    if (user.role !== 'employee') return err('Only employees can submit requests.');
    if (r.employee_email !== user.email) return err('You can only submit a request for yourself.');
    if (r.employee_name !== user.full_name || r.annual_days !== user.annual_days) {
      return err('Your details do not match the employee list.');
    }
    const win = db.windows.find((w) => w.id === r.window_id);
    if (!win || win.window_year !== r.request_year || !isWindowOpen(win, today)) {
      return err('This submission window is not open.');
    }
    const already = db.requests.some((x) => {
      const w = db.windows.find((v) => v.id === x.window_id);
      return x.employee_email === user.email && x.request_year === r.request_year && isCounted(x, w, today);
    });
    if (already) return err('You can buy or sell only once a year. You already have a request for this year.');
    if (!r.declaration_accepted) return err('You must confirm the declaration.');
    if (!Number.isInteger(r.days) || r.days <= 0) return err('Choose at least 1 day.');
    if (!Number.isInteger(r.used_days) || r.used_days < 0 || r.used_days > r.annual_days) return err('Used days are not valid.');
    if (!EMAIL_RE.test(r.manager_email || '')) return err('Enter a valid email for your direct manager.');
    const row = {
      id: Math.max(100, ...db.requests.map((x) => x.id)) + 1,
      window_id: r.window_id,
      request_year: r.request_year,
      employee_email: r.employee_email,
      employee_name: r.employee_name,
      annual_days: r.annual_days,
      used_days: r.used_days,
      days: r.days,
      manager_email: r.manager_email.toLowerCase(),
      senior_manager_email: r.senior_manager_email ? r.senior_manager_email.toLowerCase() : null,
      declaration_accepted: true,
      status: 'pending',
      decided_at: null,
      created_at: new Date().toISOString(),
    };
    return { row };
  }

  upsertEmployees(db, user) {
    if (this.table !== 'employees') return err('Not supported in the demo.');
    if (user.role !== 'hr') return err('Only HR can load employees.');
    const written = [];
    for (const r of this.payload) {
      const email = String(r.email || '').toLowerCase();
      const existing = db.employees.find((e) => e.email === email);
      const row = {
        email,
        full_name: r.full_name,
        role: r.role,
        annual_days: r.annual_days,
        updated_at: new Date().toISOString(),
      };
      if (existing) Object.assign(existing, row);
      else db.employees.push(row);
      written.push(row);
    }
    return this.done(db, written);
  }

  updateRequests(db, user, today) {
    if (this.table !== 'requests') return err('Not supported in the demo.');
    const allowed = Object.keys(this.payload).every((k) => ['status', 'decided_at'].includes(k));
    if (!allowed) return err('Only the status can be changed.');
    let rows = db.requests.filter((r) => canRead('requests', r, user));
    for (const [c, v] of this.filters) rows = rows.filter((r) => r[c] === v);
    rows = rows.filter((r) => {
      if (user.role === 'hr') return true;
      const win = db.windows.find((w) => w.id === r.window_id);
      return (
        user.role === 'manager' &&
        r.manager_email === user.email &&
        r.status === 'pending' &&
        win && win.end_date >= today &&
        ['approved', 'rejected'].includes(this.payload.status)
      );
    });
    for (const r of rows) Object.assign(r, this.payload);
    return this.done(db, rows);
  }
}

function sessionFor(user) {
  return user ? { access_token: 'demo-token', user: { email: user.email } } : null;
}

export const sb = {
  from: (table) => new Query(table),
  auth: {
    async getSession() {
      const db = load();
      return { data: { session: sessionFor(currentUser(db)) }, error: null };
    },
    async signInWithPassword({ email }) {
      const user = load().employees.find((e) => e.email === String(email).toLowerCase());
      if (!user) return { data: null, error: { message: 'Unknown demo user.' } };
      store(USER_KEY, user.email);
      return { data: { session: sessionFor(user) }, error: null };
    },
    async signOut() {
      store(USER_KEY, null);
      return { error: null };
    },
  },
};
