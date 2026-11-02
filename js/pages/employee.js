import { initProtectedPage } from '../auth.js';
import { sb } from '../data-source.js';
import { calcEligibility, validateUsedDays, whyNotSell } from '../../lib/eligibility.js';
import {
  dayValueGross, dayValueNet, monthlyDeduction, validateSimulator, formatMoney,
} from '../../lib/pricing.js';
import { todayIsrael, isWindowOpen, isCounted, statusInfo, requestNumber } from '../../lib/rules.js';
import { askAi, DEMO_NOTICE } from '../mock-ai.js';
import { el, showMessage, formatDate, badge, typeBadge } from '../ui.js';
import { applyIcons } from '../icons.js';

const $ = (id) => document.getElementById(id);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SCREENS = ['onboarding', 'request', 'confirm', 'summary'];

function showScreen(name) {
  for (const s of SCREENS) $(`screen-${s}`).hidden = s !== name;
  const heading = $(`h-${name}`);
  if (heading) heading.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function setError(inputId, text) {
  const input = $(inputId);
  const errorEl = $(`${inputId}-error`);
  errorEl.textContent = text || '';
  if (text) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
}

async function main() {
  const ctx = await initProtectedPage('employee');
  if (!ctx) return;
  const { profile } = ctx;
  const annual = profile.annual_days;
  const status = $('status');
  applyIcons();

  let policy;
  try {
    policy = await fetch('data/policy.json').then((r) => r.json());
  } catch {
    showMessage(status, 'Could not load the policy. Serve the site over http (for example: npx serve).', 'error');
    return;
  }

  const today = todayIsrael();
  const [winRes, reqRes] = await Promise.all([
    sb.from('windows').select('*').order('start_date'),
    sb.from('requests').select('*').order('created_at', { ascending: false }),
  ]);
  const windows = winRes.data || [];
  let requests = reqRes.data || [];
  const winOf = (r) => windows.find((w) => w.id === r.window_id);
  const openWindowFor = (type) => windows.find((w) => w.type === type && isWindowOpen(w, today)) || null;

  // ---------- Screen 4: Summary ----------
  function showSummary(req) {
    const win = winOf(req);
    $('s-number').textContent = requestNumber(req.id);
    $('s-approver').textContent = req.manager_email;
    $('s-type').replaceChildren(typeBadge(win.type));
    $('s-days').textContent = `${req.days} ${req.days === 1 ? 'day' : 'days'}`;
    $('s-window').textContent = `${formatDate(win.start_date)} to ${formatDate(win.end_date)}`;
    $('s-status').replaceChildren(badge(statusInfo(req, win, today)));
    showScreen('summary');
  }

  // ---------- Screen 1: Onboarding ----------
  $('policy-title').textContent = policy.title;
  $('policy-intro').replaceChildren(policy.intro + ' ', el('strong', { class: 'emph', text: policy.highlight }));
  $('policy-sections').append(
    ...policy.sections.map((s) =>
      el('section', {}, el('h3', { text: s.heading }), el('ul', {}, ...s.paragraphs.map((p) => (p.startsWith('**') && p.endsWith('**') ? el('li', {}, el('strong', { text: p.slice(2, -2) })) : el('li', { text: p }))))),
    ),
  );
  $('declaration-text').textContent = policy.declaration;

  const tbody = $('windows-body');
  for (const w of windows) {
    const open = isWindowOpen(w, today);
    tbody.append(
      el('tr', {},
        el('td', {}, typeBadge(w.type)),
        el('td', { text: formatDate(w.start_date) }),
        el('td', { text: formatDate(w.end_date) }),
        el('td', {}, el('span', { class: `badge ${open ? 'badge-open' : 'badge-closed'}`, text: open ? 'Open' : w.end_date < today ? 'Ended' : 'Not yet open' })),
      ),
    );
  }
  $('no-window-note').hidden = windows.some((w) => isWindowOpen(w, today));

  $('accept').addEventListener('change', () => {
    $('to-request').disabled = !$('accept').checked;
  });
  $('to-request').addEventListener('click', () => {
    if ($('accept').checked) showScreen('request');
  });

  // ---------- Screen 2: Request ----------
  $('annual-note').textContent = `Annual entitlement: ${annual} days`;
  $('used').setAttribute('aria-describedby', 'annual-note used-error');
  $('ai-notice').textContent = DEMO_NOTICE;

  const state = { used: null, dayValue: null, sim: null, simType: 'buy', manager: '', senior: '', type: null };

  function updateEligibility() {
    const raw = $('used').value;
    const v = validateUsedDays(raw, annual);
    if (raw.trim() === '') {
      setError('used', '');
      state.used = null;
    } else if (!v.ok) {
      setError('used', v.error);
      state.used = null;
    } else {
      setError('used', '');
      state.used = v.value;
    }
    if (state.used === null) {
      $('elig-buy').textContent = '-';
      $('elig-sell').textContent = '-';
      $('elig-why').textContent = 'Enter the days you used this year to see what you are eligible for.';
      return;
    }
    const e = calcEligibility(annual, state.used);
    $('elig-buy').textContent = e.maxBuy > 0 ? `1-${e.maxBuy} days` : 'Not eligible';
    $('elig-sell').textContent = e.maxSell > 0 ? `up to ${e.maxSell} days` : 'Not eligible';
    $('elig-why').textContent = e.maxSell > 0 ? '' : `Selling: ${whyNotSell(annual, state.used)}`;
  }
  $('used').addEventListener('input', updateEligibility);

  function readSim() {
    return validateSimulator({ salary: $('salary').value, workPercent: $('workpct').value, taxPercent: $('tax').value });
  }

  function updateSimulator(showEmpty = false) {
    const sim = readSim();
    for (const [field, id] of [['salary', 'salary'], ['workPercent', 'workpct'], ['taxPercent', 'tax']]) {
      const empty = $(id).value.trim() === '';
      setError(id, sim.errors[field] && (showEmpty || !empty) ? sim.errors[field] : '');
    }
    state.simType = document.querySelector('input[name="simtype"]:checked').value;
    $('sim-label').textContent =
      state.simType === 'buy'
        ? 'Buy - monthly deduction per day over 5 payslips (estimated)'
        : 'Sell - credit per day in the December payslip (estimated)';
    const base = !sim.errors.salary && !sim.errors.workPercent;
    const { salary, workPercent, taxPercent } = sim.values;
    const gross = base ? dayValueGross(salary, workPercent) : null;
    const net = base && !sim.errors.taxPercent ? dayValueNet(gross, taxPercent) : null;
    state.sim = sim.ok ? { gross, net } : null;
    state.dayValue = gross === null ? null : { gross, net };
    $('sim-gross').textContent = gross === null ? '-' : formatMoney(gross);
    $('sim-net').textContent = net === null ? '-' : formatMoney(net);
    $('sim-extra').textContent =
      gross === null ? '-' : formatMoney(state.simType === 'buy' ? monthlyDeduction(gross) : gross);
  }
  for (const id of ['salary', 'workpct', 'tax']) $(id).addEventListener('input', () => updateSimulator());
  $('tax').addEventListener('change', () => updateSimulator());
  for (const r of document.querySelectorAll('input[name="simtype"]')) r.addEventListener('change', () => updateSimulator());

  // AI interview (pre-written replies)
  const chat = $('chat');
  const bubble = (kind, text) => {
    chat.append(el('div', { class: `bubble ${kind}`, text }));
    chat.scrollTop = chat.scrollHeight;
  };
  bubble('ai', 'Hi! Tell me if you are thinking about buying or selling vacation days, and I will explain what the policy allows.');
  const messages = [];
  $('chat-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = $('chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    messages.push({ role: 'user', text });
    bubble('user', text);
    $('chat-send').disabled = true;
    const result = await askAi({ annualDays: annual, usedDays: state.used, messages, formula: policy.formula, dayValue: state.dayValue });
    $('chat-send').disabled = false;
    if (!result.ok) {
      bubble('sys', result.message);
      return;
    }
    bubble('ai', result.data.reply);
    const said = result.data.used_days_mentioned;
    if (said !== null && state.used !== null && said !== state.used) {
      bubble('sys', `You wrote ${said} days used, but the field says ${state.used}. The field is used.`);
    }
    if (result.data.uncertain) bubble('sys', 'The assistant is not certain. Please check the policy on the first screen.');
  });

  $('to-confirm').addEventListener('click', () => {
    updateEligibility();
    const problems = [];
    const rawUsed = $('used').value.trim();
    if (state.used === null) {
      if (rawUsed === '') setError('used', 'Enter the number of vacation days you used this year.');
      problems.push('used');
    }
    const mgr = $('mgr').value.trim().toLowerCase();
    const senior = $('senior').value.trim().toLowerCase();
    if (!EMAIL_RE.test(mgr)) {
      setError('mgr', 'Enter your approving manager\'s email address.');
      problems.push('mgr');
    } else setError('mgr', '');
    if (senior && !EMAIL_RE.test(senior)) {
      setError('senior', 'Enter a valid email address, or leave this empty.');
      problems.push('senior');
    } else setError('senior', '');

    if (problems.length) {
      showMessage($('msg-request'), 'Please fix the fields marked in red before continuing.', 'error');
      $(problems[0]).focus();
      return;
    }
    showMessage($('msg-request'), '');
    state.manager = mgr;
    state.senior = senior || null;
    prepareConfirm();
    showScreen('confirm');
  });

  // ---------- Screen 3: Confirm and submit ----------
  function availability(type) {
    const e = calcEligibility(annual, state.used);
    const max = type === 'buy' ? e.maxBuy : e.maxSell;
    const win = openWindowFor(type);
    if (max <= 0) {
      return { ok: false, max, reason: type === 'buy' ? 'Not eligible to buy.' : whyNotSell(annual, state.used) || 'Not eligible to sell.' };
    }
    if (!win) {
      return { ok: false, max, reason: `No ${type} window is open right now.` };
    }
    return { ok: true, max, win, reason: `Window open until ${formatDate(win.end_date)}.` };
  }

  function prepareConfirm() {
    state.type = null;
    $('days').value = '';
    $('declare').checked = false;
    showMessage($('msg-confirm'), '');
    for (const type of ['buy', 'sell']) {
      const a = availability(type);
      $(`${type}-range`).textContent = a.max > 0 ? (type === 'buy' ? `1-${a.max} days` : `up to ${a.max} days`) : 'Not eligible';
      $(`pick-${type}`).disabled = !a.ok;
      $(`${type}-note`).textContent = a.reason;
      $(`choice-${type}`).dataset.selected = 'false';
      $(`pick-${type}`).setAttribute('aria-pressed', 'false');
      $(`pick-${type}`).textContent = type === 'buy' ? 'Buy' : 'Sell';
      $(`change-${type}`).hidden = true;
    }
    refreshConfirm();
  }

  // Buy and Sell are mutually exclusive: choosing one locks the other until "Change choice".
  function pick(type) {
    if (state.type) return;
    state.type = type;
    const other = type === 'buy' ? 'sell' : 'buy';
    const label = type === 'buy' ? 'Buy' : 'Sell';
    $(`choice-${type}`).dataset.selected = 'true';
    $(`pick-${type}`).setAttribute('aria-pressed', 'true');
    $(`pick-${type}`).textContent = `${label} selected`;
    $(`change-${type}`).hidden = false;
    $(`choice-${other}`).dataset.selected = 'false';
    $(`pick-${other}`).disabled = true;
    $(`${other}-note`).textContent = `Not available while ${label} is selected.`;
    $('days').value = '';
    $('days').disabled = false;
    $('days').focus();
    refreshConfirm();
  }
  $('pick-buy').addEventListener('click', () => pick('buy'));
  $('pick-sell').addEventListener('click', () => pick('sell'));
  $('change-buy').addEventListener('click', prepareConfirm);
  $('change-sell').addEventListener('click', prepareConfirm);

  function chosenDays() {
    if (!state.type) return { ok: false };
    const a = availability(state.type);
    const raw = $('days').value.trim();
    if (raw === '') return { ok: false, empty: true, max: a.max };
    if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > a.max) {
      return { ok: false, max: a.max, error: `Choose a whole number from 1 to ${a.max}.` };
    }
    return { ok: true, value: Number(raw), max: a.max };
  }

  function refreshConfirm() {
    const type = state.type;
    $('days').disabled = !type;
    const maxDays = type ? availability(type).max : 0;
    const current = /^\d+$/.test($('days').value.trim()) ? Number($('days').value.trim()) : 0;
    $('days-minus').disabled = !type || current <= 1;
    $('days-plus').disabled = !type || current >= maxDays;
    $('days-hint').textContent = type ? `You can choose 1 to ${availability(type).max} days.` : 'Choose Buy or Sell first.';
    const d = chosenDays();
    setError('days', d.error || '');
    $('submit').disabled = !(d.ok && $('declare').checked);
  }
  $('days').addEventListener('input', refreshConfirm);
  function stepDays(delta) {
    if (!state.type) return;
    const max = availability(state.type).max;
    const raw = $('days').value.trim();
    const current = /^\d+$/.test(raw) ? Number(raw) : 0;
    $('days').value = String(Math.min(max, Math.max(1, current + delta)));
    refreshConfirm();
  }
  $('days-minus').addEventListener('click', () => stepDays(-1));
  $('days-plus').addEventListener('click', () => stepDays(1));
  $('declare').addEventListener('change', refreshConfirm);
  $('back-request').addEventListener('click', () => showScreen('request'));

  $('submit').addEventListener('click', async () => {
    const d = chosenDays();
    if (!d.ok || !$('declare').checked) return;
    const type = state.type;
    const a = availability(type);
    if (!a.ok) {
      showMessage($('msg-confirm'), a.reason, 'error');
      return;
    }
    $('submit').disabled = true;
    const { error } = await sb.from('requests').insert({
      window_id: a.win.id,
      request_year: a.win.window_year,
      employee_email: profile.email,
      employee_name: profile.full_name,
      annual_days: annual,
      used_days: state.used,
      days: d.value,
      manager_email: state.manager,
      senior_manager_email: state.senior,
      declaration_accepted: true,
    });
    if (error) {
      showMessage($('msg-confirm'), error.message, 'error');
      $('submit').disabled = false;
      return;
    }
    const fresh = await sb.from('requests').select('*').order('created_at', { ascending: false });
    requests = fresh.data || [];
    const counted = requests.find((r) => isCounted(r, winOf(r), today));
    showSummary(counted || requests[0]);
  });

  // ---------- Start ----------
  updateEligibility();
  updateSimulator();
  $('app-ready')?.remove();
  const counted = requests.find((r) => isCounted(r, winOf(r), today));
  if (counted) {
    showSummary(counted);
  } else {
    const last = requests[0];
    if (last && last.status === 'rejected') {
      const banner = $('rejected-banner');
      banner.textContent = `Your previous request ${requestNumber(last.id)} was rejected. You can submit a new request this year.`;
      banner.hidden = false;
    }
    showScreen('onboarding');
  }
}

main();
