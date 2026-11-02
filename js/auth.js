import { sb } from './data-source.js';
import { renderHeader, showMessage } from './ui.js';

export const ROLE_PAGE = {
  employee: 'employee.html',
  manager: 'manager.html',
  hr: 'hr.html',
};

export function signIn(email, password) {
  return sb.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  await sb.auth.signOut();
  window.location.href = 'index.html';
}

// The signed-in user's row in `employees` (RLS lets each user read only their own, HR reads all).
// Returns { session, profile }. profile is null when the user has no row (= no permission).
export async function getSessionAndProfile() {
  const { data } = await sb.auth.getSession();
  const session = data.session;
  if (!session) return { session: null, profile: null };
  const { data: profile } = await sb
    .from('employees')
    .select('email, full_name, role, annual_days')
    .eq('email', session.user.email.toLowerCase())
    .maybeSingle();
  return { session, profile: profile || null };
}

// Guard for pages that need a signed-in user. `role` limits the page to one role (UX only,
// the real protection is RLS). Returns { session, profile } or null after redirecting.
export async function initProtectedPage(role = null) {
  const header = document.getElementById('app-header');
  const status = document.getElementById('status');
  const { session, profile } = await getSessionAndProfile();

  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  if (!profile) {
    renderHeader(header, null, signOut);
    showMessage(status, 'No permission: this account is not in the employee list.', 'error');
    await sb.auth.signOut();
    return null;
  }
  if (role && profile.role !== role) {
    window.location.href = ROLE_PAGE[profile.role];
    return null;
  }
  renderHeader(header, profile, signOut);
  return { session, profile };
}
