// Pre-written "AI interview" replies for the prototype. No model is called.
// Same result shape as the real /api/ask contract (ARCHITECTURE 5.3). Numbers come from lib/eligibility.js.
import { calcEligibility } from '../lib/eligibility.js';
import { formatMoney } from '../lib/pricing.js';

export const DEMO_NOTICE = 'Demo mode: replies are pre-written, no real AI is called.';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (reply, intent = 'unknown', uncertain = false, used = null) => ({
  ok: true,
  data: { reply, intent, used_days_mentioned: used, uncertain },
});

// messages: [{ role: 'user', text }], usedDays: number or null.
// formula: the day-value formula text from the policy. dayValue: { gross, net } from the simulator, or null.
export async function askAi({ annualDays, usedDays, messages, formula = null, dayValue = null }) {
  await wait(700);
  const text = (messages[messages.length - 1]?.text || '').trim();
  const lower = text.toLowerCase();

  if (lower.startsWith('/fail')) {
    return {
      ok: false,
      error: 'ai_unavailable',
      message: 'The AI service is not available right now. You can continue without it.',
    };
  }
  if (!text || text.length > 500) {
    return { ok: false, error: 'bad_input', message: 'Write a message of up to 500 characters.' };
  }

  const mention = lower.match(/(\d+)\s*(?:vacation\s*)?days?\s*(?:already\s*)?(?:used|taken|so far)/);
  const mentioned = mention ? Number(mention[1]) : null;

  if (/approve|reject|accept my|decide for me|confirm my request/.test(lower)) {
    return ok('I cannot approve, reject or decide on requests. Your approving manager makes that decision.', 'unknown', false, mentioned);
  }
  if (/ignore|previous instructions|system prompt/.test(lower)) {
    return ok('I can only help with questions about buying or selling vacation days under the policy.', 'unknown', true, mentioned);
  }
  if (formula && /formula|calculat|day.?s? (value|worth|cost|rate)|(value|worth|cost|rate) of (a|one|each|my) (vacation )?day|per day|how (much|is).*(day|cost|worth)|gross|net value/.test(lower)) {
    const mine =
      dayValue && dayValue.gross != null
        ? ` With the values in your simulator, one day is about ${formatMoney(dayValue.gross)} gross${dayValue.net != null ? ` and ${formatMoney(dayValue.net)} net` : ''}.`
        : ' Fill in the simulator to see the value of a day for you.';
    return ok(`${formula.gross} ${formula.net}${mine} ${formula.note}`, 'unknown', false, mentioned);
  }
  if (usedDays === null) {
    return ok('Please enter how many vacation days you used this year first, so I can explain what you are eligible for.', 'unknown', true, mentioned);
  }

  const e = calcEligibility(annualDays, usedDays);
  if (/sell|cash/.test(lower)) {
    if (e.maxSell > 0) {
      return ok(
        `Under the policy you can sell 1 to ${e.maxSell} days: up to 20% of your ${annualDays} annual days, and no more than your remaining ${e.remaining} days. The payment is credited once, in your December payslip.`,
        'sell', false, mentioned);
    }
    const why = usedDays < 7
      ? `you need to use at least 7 days first, and you used ${usedDays}`
      : 'you have no remaining balance to sell';
    return ok(`You cannot sell right now: ${why}.`, 'sell', false, mentioned);
  }
  if (/buy|purchase|extra|additional|more days/.test(lower)) {
    return ok(
      `Under the policy you can buy 1 to ${e.maxBuy} days: up to 40% of your ${annualDays} annual days, rounded down. The cost is deducted over 5 monthly payslips.`,
      'buy', false, mentioned);
  }
  return ok(
    'I am not sure what you are asking. I can explain buying or selling vacation days under the policy. Do you want to buy or sell?',
    'unknown', true, mentioned);
}
