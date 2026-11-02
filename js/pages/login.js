import { signIn, getSessionAndProfile, ROLE_PAGE } from '../auth.js';
import { listDemoUsers, resetDemo } from '../mock-client.js';
import { DEMO_HINTS } from '../mock-data.js';
import { el, showMessage, avatar } from '../ui.js';

const list = document.getElementById('user-list');
const status = document.getElementById('status');

const ROLE_LABEL = { employee: 'Employee', manager: 'Manager', hr: 'HR' };

function renderUsers() {
  list.textContent = '';
  for (const user of listDemoUsers()) {
    list.append(
      el(
        'li',
        { class: 'user-row' },
        el(
          'div',
          { class: 'person' },
          avatar(user.full_name),
          el(
            'div',
            {},
            el('strong', { text: user.full_name }),
            ' ',
            el('span', { class: 'role-badge', text: ROLE_LABEL[user.role] }),
            el('div', { class: 'small', text: DEMO_HINTS[user.email] || user.email }),
          ),
        ),
        el('button', {
          type: 'button',
          class: 'btn',
          'aria-label': `Continue as ${user.full_name}, ${ROLE_LABEL[user.role]}`,
          onclick: () => continueAs(user.email),
          text: 'Continue',
        }),
      ),
    );
  }
}

async function continueAs(email) {
  const { error } = await signIn(email, '');
  if (error) {
    showMessage(status, 'Could not sign in with this demo user.', 'error');
    return;
  }
  const { profile } = await getSessionAndProfile();
  if (!profile) {
    showMessage(status, 'No permission: this account is not in the employee list.', 'error');
    return;
  }
  window.location.href = ROLE_PAGE[profile.role];
}

document.getElementById('reset').addEventListener('click', () => {
  resetDemo();
  renderUsers();
  showMessage(status, 'Demo data was reset.', 'ok');
});

renderUsers();
const { session, profile } = await getSessionAndProfile();
if (session && profile) window.location.href = ROLE_PAGE[profile.role];
