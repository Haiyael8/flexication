// Pure functions, no browser dependency. All math on whole numbers.

// annualDays: yearly entitlement, usedDays: days already used this year.
export function calcEligibility(annualDays, usedDays) {
  const remaining = annualDays - usedDays;
  const maxBuy = Math.floor((annualDays * 2) / 5); // 40%
  const maxSell =
    usedDays >= 7 ? Math.max(0, Math.min(Math.floor(annualDays / 5), remaining)) : 0; // 20%, capped by balance
  return { remaining, maxBuy, maxSell };
}

// Validates the "days I used this year" field. Returns { ok, value, error }.
export function validateUsedDays(raw, annualDays) {
  const text = String(raw ?? '').trim();
  if (text === '') return { ok: false, error: 'Enter the number of vacation days you used this year.' };
  if (!/^\d+$/.test(text)) return { ok: false, error: 'Enter a whole number, zero or higher.' };
  const value = Number(text);
  if (value > annualDays) {
    return { ok: false, error: `This cannot be more than your annual entitlement (${annualDays} days).` };
  }
  return { ok: true, value };
}

// Short reason shown when an action is not available.
export function whyNotSell(annualDays, usedDays) {
  if (usedDays < 7) return `You need to use at least 7 days before selling (you used ${usedDays}).`;
  if (annualDays - usedDays <= 0) return 'You have no remaining balance to sell.';
  return null;
}
