import { initProtectedPage } from '../auth.js';
import { sb } from '../data-source.js';
import { parseCsvFile, validateEmployeeRows, buildPayrollCsv, downloadCsv } from '../csv.js';
import { todayIsrael, isWindowOpen, statusInfo, requestNumber } from '../../lib/rules.js';
import { el, showMessage, formatDate, badge, typeBadge } from '../ui.js';

const ctx = await initProtectedPage('hr');
if (ctx) {
  const $ = (id) => document.getElementById(id);
  const today = todayIsrael();
  $('content').hidden = false;

  const cell = (text, cls) => el('td', { class: cls, text });
  const windowStatus = (w) => {
    const open = isWindowOpen(w, today);
    return el('span', {
      class: `badge ${open ? 'badge-open' : 'badge-closed'}`,
      text: open ? 'Open' : w.end_date < today ? 'Ended' : 'Not yet open',
    });
  };

  async function loadAll() {
    const [w, e, r] = await Promise.all([
      sb.from('windows').select('*').order('start_date', { ascending: false }),
      sb.from('employees').select('*').order('email'),
      sb.from('requests').select('*, windows(type, start_date, end_date)').order('created_at', { ascending: false }),
    ]);
    renderWindows(w.data || []);
    renderEmployees(e.data || []);
    renderRequests(r.data || []);
    renderReportOptions(w.data || [], r.data || []);
  }

  function renderWindows(windows) {
    const body = $('windows-body');
    body.textContent = '';
    for (const w of windows) {
      body.append(el('tr', {},
        el('td', {}, typeBadge(w.type)),
        cell(formatDate(w.start_date)),
        cell(formatDate(w.end_date)),
        el('td', {}, windowStatus(w)),
      ));
    }
  }

  function renderEmployees(rows) {
    const body = $('employees-body');
    body.textContent = '';
    for (const r of rows) {
      body.append(el('tr', {}, cell(r.email), cell(r.full_name), cell(r.role === 'hr' ? 'HR' : r.role), cell(r.annual_days, 'num')));
    }
  }

  function renderRequests(rows) {
    const body = $('requests-body');
    body.textContent = '';
    if (!rows.length) body.append(el('tr', {}, el('td', { colspan: 5, class: 'muted', text: 'No requests yet.' })));
    for (const r of rows) {
      body.append(el('tr', {},
        cell(requestNumber(r.id)),
        cell(r.employee_name),
        el('td', {}, typeBadge(r.windows.type)),
        cell(r.days, 'num'),
        el('td', {}, badge(statusInfo(r, r.windows, today))),
      ));
    }
  }

  // ---- Open a window ----
  $('window-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const type = $('w-type').value;
    const start = $('w-start').value;
    const end = $('w-end').value;
    const errorEl = $('w-error');
    errorEl.textContent = '';
    if (!start || !end) {
      errorEl.textContent = 'Choose a start date and an end date.';
      return;
    }
    if (end < start) {
      errorEl.textContent = 'The end date cannot be before the start date.';
      return;
    }
    const { error } = await sb.from('windows').insert({ type, start_date: start, end_date: end });
    if (error) {
      showMessage($('msg-window'), error.message, 'error');
      return;
    }
    showMessage($('msg-window'), `A ${type} window was opened from ${formatDate(start)} to ${formatDate(end)}.`, 'ok');
    $('window-form').reset();
    await loadAll();
  });

  // ---- Employees CSV ----
  let pendingRows = [];
  $('csv-file').addEventListener('change', async () => {
    const file = $('csv-file').files[0];
    const box = $('csv-summary');
    box.textContent = '';
    showMessage($('msg-csv'), '');
    pendingRows = [];
    if (!file) return;
    let parsed;
    try {
      parsed = await parseCsvFile(file);
    } catch {
      showMessage($('msg-csv'), 'The file could not be read as CSV.', 'error');
      return;
    }
    const result = validateEmployeeRows(parsed.data, parsed.meta.fields || []);
    if (result.fatal) {
      showMessage($('msg-csv'), result.fatal, 'error');
      return;
    }
    pendingRows = result.valid;
    box.append(el('p', {}, el('strong', { text: `${result.valid.length} valid rows, ${result.rejected.length} rejected.` })));
    if (result.rejected.length) {
      box.append(el('ul', {}, ...result.rejected.map((x) => el('li', { text: `Line ${x.line}${x.email ? ` (${x.email})` : ''}: ${x.reason}` }))));
    }
    if (result.valid.length) {
      box.append(el('button', { type: 'button', class: 'btn', onclick: confirmLoad, text: `Load ${result.valid.length} valid rows` }));
    }
  });

  async function confirmLoad() {
    const { error } = await sb.from('employees').upsert(pendingRows, { onConflict: 'email' });
    if (error) {
      showMessage($('msg-csv'), error.message, 'error');
      return;
    }
    showMessage($('msg-csv'), `${pendingRows.length} employees were loaded (existing ones updated, none removed).`, 'ok');
    $('csv-summary').textContent = '';
    $('csv-file').value = '';
    pendingRows = [];
    await loadAll();
  }

  // ---- Payroll report ----
  let allRequests = [];
  function renderReportOptions(windows, requests) {
    allRequests = requests;
    const select = $('r-window');
    const current = select.value;
    select.textContent = '';
    select.append(el('option', { value: 'all', text: 'All windows' }));
    for (const w of windows) {
      select.append(el('option', { value: String(w.id), text: `${w.type === 'buy' ? 'Buy' : 'Sell'}: ${formatDate(w.start_date)} to ${formatDate(w.end_date)}` }));
    }
    if ([...select.options].some((o) => o.value === current)) select.value = current;
    updateReportCount();
  }
  const reportRows = () =>
    allRequests.filter((r) => r.status === 'approved' && ($('r-window').value === 'all' || String(r.window_id) === $('r-window').value));
  function updateReportCount() {
    const n = reportRows().length;
    $('report-count').textContent = `${n} approved ${n === 1 ? 'request' : 'requests'} in this report.`;
  }
  $('r-window').addEventListener('change', updateReportCount);
  $('download').addEventListener('click', () => {
    const rows = reportRows();
    if (!rows.length) {
      showMessage($('msg-report'), 'There are no approved requests to export for this selection.', 'error');
      return;
    }
    downloadCsv(`payroll-report-${today}.csv`, buildPayrollCsv(rows));
    showMessage($('msg-report'), `Downloaded ${rows.length} rows.`, 'ok');
  });

  await loadAll();
}
