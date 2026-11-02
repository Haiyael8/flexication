import { dateIsrael } from '../lib/rules.js';

// Shows a message in an aria-live element. kind: 'error' | 'ok' | 'info'. Empty text clears it.
export function showMessage(el, text, kind = 'info') {
  el.textContent = text;
  el.className = text ? `message ${kind}` : 'message';
}

// Builds a DOM element safely (text is never parsed as HTML).
// props: class, text, on* handlers, and any other value becomes an attribute (false/null skips it).
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

// 'YYYY-MM-DD' -> '02 Nov 2026'
export function formatDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatTimestamp(isoTimestamp) {
  return formatDate(dateIsrael(isoTimestamp));
}

// A status label: always a word, never colour alone.
export function badge(info) {
  return el('span', { class: `badge badge-${info.key}`, text: info.label });
}

export function typeBadge(type) {
  return el('span', { class: `badge badge-${type}`, text: type === 'buy' ? 'Buy' : 'Sell' });
}

export function renderHeader(headerEl, profile, onSignOut) {
  headerEl.textContent = '';
  headerEl.append(el('a', { class: 'brand', href: 'index.html', text: 'Flexication' }));
  if (!profile) return;
  headerEl.append(
    el(
      'div',
      { class: 'user-area' },
      el('span', { text: profile.full_name }),
      el('span', { class: 'role-badge', text: profile.role === 'hr' ? 'HR' : profile.role }),
      el('button', { type: 'button', class: 'btn btn-outline', onclick: onSignOut, text: 'Sign out' }),
    ),
  );
}

export function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

export function avatar(name) {
  return el('span', { class: 'avatar', 'aria-hidden': 'true', text: initials(name) });
}
