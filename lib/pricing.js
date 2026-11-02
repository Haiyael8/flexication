// Pure functions. Money is calculated in whole agorot (cents) to avoid decimal errors.
const WORKING_DAYS_PER_MONTH = 21.6;

const toCents = (shekels) => Math.round(shekels * 100);
const toShekels = (cents) => cents / 100;

// Gross value of one vacation day, in agorot. workPercent: 1-100.
function dayValueGrossCents(monthlySalary, workPercent) {
  return Math.round((monthlySalary * 10000) / (workPercent * WORKING_DAYS_PER_MONTH));
}

export function dayValueGross(monthlySalary, workPercent) {
  return toShekels(dayValueGrossCents(monthlySalary, workPercent));
}

export function dayValueNet(grossValue, taxPercent) {
  return toShekels(Math.round(toCents(grossValue) * (1 - taxPercent / 100)));
}

// Buy only: the total cost spread over 5 payslips.
export function monthlyDeduction(totalAbs) {
  return toShekels(Math.round(toCents(totalAbs) / 5));
}

// Validates the simulator inputs. Returns { ok, errors, values }.
// Accepts values such as "15,000" or "₪15000".
const parseNumber = (raw) => Number(String(raw ?? '').replace(/[,\s₪]/g, ''));

export function validateSimulator({ salary, workPercent, taxPercent }) {
  const errors = {};
  const s = parseNumber(salary);
  const w = parseNumber(workPercent);
  const t = parseNumber(taxPercent);
  if (String(salary ?? '').trim() === '' || !Number.isFinite(s) || s <= 0) {
    errors.salary = 'Enter a monthly salary above zero.';
  }
  if (String(workPercent ?? '').trim() === '' || !Number.isFinite(w) || w < 1 || w > 100) {
    errors.workPercent = 'Enter an employment percentage from 1 to 100.';
  }
  if (String(taxPercent ?? '').trim() === '' || !Number.isFinite(t) || t < 0 || t > 100) {
    errors.taxPercent = 'Select a tax bracket.';
  }
  return { ok: Object.keys(errors).length === 0, errors, values: { salary: s, workPercent: w, taxPercent: t } };
}

export function formatMoney(amount) {
  const sign = amount < 0 ? '-' : '';
  return `${sign}₪${Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
