// Employee CSV import (needs PapaParse from the page) and payroll report export.
import { requestNumber } from '../lib/rules.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['employee', 'manager', 'hr'];
export const EMPLOYEE_COLUMNS = ['email', 'full_name', 'role', 'annual_days'];

export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    window.Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      transformHeader: (h) => h.replace(/^﻿/, '').trim().toLowerCase(),
      complete: (res) => resolve(res),
      error: (e) => reject(e),
    });
  });
}

// Checks every row. Returns { valid: [...], rejected: [{ line, email, reason }] }.
export function validateEmployeeRows(rows, headers) {
  const missing = EMPLOYEE_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length) return { fatal: `Missing columns: ${missing.join(', ')}.`, valid: [], rejected: [] };

  const valid = [];
  const rejected = [];
  const seen = new Set();
  rows.forEach((r, i) => {
    const line = i + 2; // line 1 is the header
    const email = String(r.email || '').trim().toLowerCase();
    const name = String(r.full_name || '').trim();
    const role = String(r.role || '').trim().toLowerCase();
    const daysText = String(r.annual_days || '').trim();
    let reason = null;
    if (!EMAIL_RE.test(email)) reason = 'Invalid email.';
    else if (seen.has(email)) reason = 'Duplicate email in the file.';
    else if (!name) reason = 'Missing full name.';
    else if (!ROLES.includes(role)) reason = 'Role must be employee, manager or hr.';
    else if (!/^\d+$/.test(daysText)) reason = 'Annual days must be a whole number, zero or higher.';
    if (reason) {
      rejected.push({ line, email, reason });
      return;
    }
    seen.add(email);
    valid.push({ email, full_name: name, role, annual_days: Number(daysText) });
  });
  return { valid, rejected };
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// rows: approved requests with windows { type }. Buy: +days. Sell: -days. Salary data stays in the HR system of record.
export function buildPayrollCsv(rows) {
  const header = ['request_id', 'employee_email', 'request_type', 'days_signed'];
  const lines = rows.map((r) => {
    const type = r.windows.type;
    const daysSigned = type === 'buy' ? r.days : -r.days;
    return [requestNumber(r.id), r.employee_email, type, daysSigned]
      .map(csvCell)
      .join(',');
  });
  return '﻿' + [header.join(','), ...lines].join('\r\n') + '\r\n';
}

export function downloadCsv(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
