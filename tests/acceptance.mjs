// Run: node tests/acceptance.mjs
import { calcEligibility, validateUsedDays } from '../lib/eligibility.js';
import { dayValueGross, monthlyDeduction, dayValueNet, validateSimulator } from '../lib/pricing.js';
import { isCounted, isWindowOpen, statusInfo, requestNumber } from '../lib/rules.js';

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
}

// Eligibility, annual entitlement 23 (MILESTONES Milestone 3 DoD).
for (const [used, sell] of [[5, 0], [7, 4], [10, 4], [14, 4], [18, 4], [21, 2], [23, 0]]) {
  const e = calcEligibility(23, used);
  check(`23 days, used ${used}: buy 9, sell ${sell}`, [e.maxBuy, e.maxSell], [9, sell]);
}

// Simulator.
check('salary 15000 at 100% = 694.44', dayValueGross(15000, 100), 694.44);
check('salary 15000 at 80% = 868.06', dayValueGross(15000, 80), 868.06);
check('monthly deduction over 5 payslips', monthlyDeduction(3472.2), 694.44);
check('net with 30% tax', dayValueNet(694.44, 30), 486.11);

check('salary typed as 15,000 is accepted', validateSimulator({ salary: '15,000', workPercent: '100', taxPercent: '31' }).ok, true);
check('missing tax bracket is reported', Object.keys(validateSimulator({ salary: '15000', workPercent: '100', taxPercent: '' }).errors), ['taxPercent']);

// Validation.
check('used days empty', validateUsedDays('', 23).ok, false);
check('used days negative', validateUsedDays('-1', 23).ok, false);
check('used days decimal', validateUsedDays('2.5', 23).ok, false);
check('used days above entitlement', validateUsedDays('24', 23).ok, false);
check('used days ok', validateUsedDays('10', 23), { ok: true, value: 10 });

// Rules.
const today = '2026-11-02';
const open = { start_date: '2026-10-30', end_date: '2026-12-01' };
const ended = { start_date: '2026-09-01', end_date: '2026-10-01' };
check('window open', isWindowOpen(open, today), true);
check('window ended is not open', isWindowOpen(ended, today), false);
check('pending in open window counts', isCounted({ status: 'pending' }, open, today), true);
check('approved counts', isCounted({ status: 'approved' }, ended, today), true);
check('rejected does not count', isCounted({ status: 'rejected' }, open, today), false);
check('pending in ended window does not count', isCounted({ status: 'pending' }, ended, today), false);
check('no decision label', statusInfo({ status: 'pending' }, ended, today).label, 'No decision');
check('request number', requestNumber(123), 'FLX-000123');

console.log(failed ? `\n${failed} FAILED` : '\nAll passed');
process.exit(failed ? 1 : 0);
