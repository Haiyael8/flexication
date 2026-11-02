// Demo data for the prototype. Emails are fake. Dates are relative to "today" (Israel time),
// so the demo always has an open window.
import { addDays } from '../lib/rules.js';

export const DEMO_VERSION = 2;

export function buildSeed(today) {
  const employees = [
    { email: 'dana.hr@flexication.test', full_name: 'Dana Shapiro', role: 'hr', annual_days: 24 },
    { email: 'david.levy@flexication.test', full_name: 'David Levy', role: 'manager', annual_days: 25 },
    { email: 'maya.cohen@flexication.test', full_name: 'Maya Cohen', role: 'employee', annual_days: 23 },
    { email: 'noa.bendavid@flexication.test', full_name: 'Noa Ben-David', role: 'employee', annual_days: 22 },
    { email: 'omer.katz@flexication.test', full_name: 'Omer Katz', role: 'employee', annual_days: 21 },
  ].map((e) => ({ ...e, updated_at: new Date().toISOString() }));

  const win = (id, type, start, end) => ({
    id,
    type,
    start_date: start,
    end_date: end,
    window_year: Number(start.slice(0, 4)),
    created_at: new Date().toISOString(),
  });
  const windows = [
    win(1, 'buy', addDays(today, -3), addDays(today, 30)),
    win(2, 'buy', addDays(today, -60), addDays(today, -30)),
    win(3, 'sell', addDays(today, -3), addDays(today, 30)),
  ];

  const req = (id, email, name, annual, used, days, status, windowId) => {
    const w = windows.find((x) => x.id === windowId);
    return {
      id,
      window_id: windowId,
      request_year: w.window_year,
      employee_email: email,
      employee_name: name,
      annual_days: annual,
      used_days: used,
      days,
      manager_email: 'david.levy@flexication.test',
      senior_manager_email: null,
      declaration_accepted: true,
      status,
      decided_at: status === 'pending' ? null : new Date().toISOString(),
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    };
  };
  const requests = [
    // Pending in the open window: counts, so Maya sees the Summary screen.
    req(101, 'maya.cohen@flexication.test', 'Maya Cohen', 23, 10, 5, 'pending', 1),
    // Rejected: does not count, so Noa can submit again.
    req(102, 'noa.bendavid@flexication.test', 'Noa Ben-David', 22, 8, 3, 'rejected', 1),
    // Pending in an ended window ("No decision"): does not count, and the manager cannot decide it.
    req(103, 'omer.katz@flexication.test', 'Omer Katz', 21, 6, 2, 'pending', 2),
  ];

  return { version: DEMO_VERSION, seededOn: today, employees, windows, requests };
}

// What the login page shows next to each demo user.
export const DEMO_HINTS = {
  'dana.hr@flexication.test': 'Open windows, upload employees, export the payroll report.',
  'david.levy@flexication.test': 'Approve or reject pending requests.',
  'maya.cohen@flexication.test': 'Already submitted a request: opens the Summary screen.',
  'noa.bendavid@flexication.test': 'Her last request was rejected, so she can submit again.',
  'omer.katz@flexication.test': 'Has not submitted yet: try the full buy or sell flow.',
};
