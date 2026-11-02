// Pure date and window rules. "Today" is always the date in Israel (YYYY-MM-DD).

export function todayIsrael(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(now);
}

export function dateIsrael(isoTimestamp) {
  return todayIsrael(new Date(isoTimestamp));
}

// Open window: start_date <= today <= end_date.
export function isWindowOpen(win, today) {
  return win.start_date <= today && today <= win.end_date;
}

// A request counts toward "once a year" when approved, or pending in a window that has not ended.
// Rejected requests, and pending requests in an ended window (no decision), do not count.
export function isCounted(request, win, today) {
  if (!win) return false;
  if (request.status === 'approved') return true;
  return request.status === 'pending' && win.end_date >= today;
}

// Label shown to people. A pending request in an ended window shows as "No decision".
export function statusInfo(request, win, today) {
  if (request.status === 'approved') return { key: 'approved', label: 'Approved' };
  if (request.status === 'rejected') return { key: 'rejected', label: 'Rejected' };
  if (win && win.end_date < today) return { key: 'nodecision', label: 'No decision' };
  return { key: 'pending', label: 'Pending approval' };
}

export function requestNumber(id) {
  return `FLX-${String(id).padStart(6, '0')}`;
}

export function addDays(isoDate, n) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
