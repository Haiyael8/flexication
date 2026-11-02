import { initProtectedPage } from '../auth.js';
import { sb } from '../data-source.js';
import { todayIsrael } from '../../lib/rules.js';
import { el, showMessage, formatDate, formatTimestamp, typeBadge, avatar } from '../ui.js';

const ctx = await initProtectedPage('manager');
if (ctx) {
  document.getElementById('content').hidden = false;
  const msg = document.getElementById('msg');
  const rowsEl = document.getElementById('rows');
  const today = todayIsrael();

  async function load() {
    const { data, error } = await sb
      .from('requests')
      .select('id, employee_name, created_at, days, windows!inner(type, end_date)')
      .eq('status', 'pending');
    if (error) {
      showMessage(msg, error.message, 'error');
      return;
    }
    // The window must not have ended: after that date a decision is no longer accepted.
    const pending = data.filter((r) => r.windows.end_date >= today);
    rowsEl.textContent = '';
    document.getElementById('empty').hidden = pending.length > 0;
    for (const r of pending) {
      rowsEl.append(
        el('tr', {},
          el('td', {}, el('div', { class: 'person' }, avatar(r.employee_name), el('span', { text: r.employee_name }))),
          el('td', { text: formatTimestamp(r.created_at) }),
          el('td', { text: formatDate(r.windows.end_date) }),
          el('td', { class: 'num', text: r.days }),
          el('td', {}, typeBadge(r.windows.type)),
          el('td', {},
            el('div', { class: 'decision' },
              el('button', { type: 'button', class: 'btn btn-sm', 'aria-label': `Approve request from ${r.employee_name}`, onclick: () => decide(r, 'approved'), text: 'Approve' }),
              el('button', { type: 'button', class: 'btn btn-sm btn-reject', 'aria-label': `Reject request from ${r.employee_name}`, onclick: () => decide(r, 'rejected'), text: 'Reject' }),
            ),
          ),
        ),
      );
    }
  }

  // Conditional update: only a still-pending request is changed. 0 rows back = not recorded.
  async function decide(request, status) {
    const { data, error } = await sb
      .from('requests')
      .update({ status, decided_at: new Date().toISOString() })
      .eq('id', request.id)
      .eq('status', 'pending')
      .select();
    if (error) {
      showMessage(msg, error.message, 'error');
    } else if (!data || data.length === 0) {
      showMessage(msg, 'The decision was not recorded: the request was already decided or its window has ended.', 'error');
    } else {
      showMessage(msg, `Request from ${request.employee_name} was ${status}. (In the full product the employee now gets an email.)`, 'ok');
    }
    await load();
  }

  await load();
}
