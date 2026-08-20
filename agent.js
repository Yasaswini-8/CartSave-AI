// agent.js
// The "brain" of CartSave AI. Given a checkout drop-off event, it decides
// which recovery action to take and produces a human-readable reasoning
// trace explaining why.
//
// Two modes:
//  - RULE MODE (default, no API key needed): deterministic heuristics.
//    This guarantees the demo always works, even offline.
//  - LLM MODE (if ANTHROPIC_API_KEY is set): asks Claude to reason over the
//    same inputs and return a structured decision. Falls back to rule mode
//    on any error, so the app never breaks.

let Anthropic;
try {
  Anthropic = require('@anthropic-ai/sdk');
} catch (e) {
  Anthropic = null;
}

const client =
  Anthropic && process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

/**
 * @param {Object} ctx
 * @param {number} ctx.cartValue - cart total in INR
 * @param {string} ctx.dropoffReason - 'card_declined' | 'price_hesitation' | 'abandoned' | 'slow_checkout'
 * @param {boolean} ctx.repeatCustomer
 * @param {number} ctx.avgOrderValue - customer's historical AOV, 0 if new
 */
async function decide(ctx) {
  if (client) {
    try {
      return await decideWithClaude(ctx);
    } catch (err) {
      console.error('[agent] Claude call failed, falling back to rules:', err.message);
      return decideWithRules(ctx);
    }
  }
  return decideWithRules(ctx);
}

function decideWithRules(ctx) {
  const { cartValue, dropoffReason, repeatCustomer, avgOrderValue } = ctx;
  const trace = [];
  let action = 'send_reminder';
  let discountPct = 0;
  let emiMonths = 0;
  let rationale = '';

  trace.push(`Observed drop-off: "${dropoffReason}" on a cart worth ₹${cartValue.toLocaleString('en-IN')}.`);

  if (dropoffReason === 'card_declined') {
    trace.push('Card declines are usually a payment-method problem, not a price problem — discounting would be wasted margin.');
    action = 'offer_alt_payment';
    rationale = 'Card was declined by the issuer. Switching rails (UPI / wallet / another card) resolves this without touching price.';
    trace.push('Decision: surface UPI + alternate card as the retry path instead of a discount.');
  } else if (cartValue > 15000) {
    trace.push(`Cart value ₹${cartValue.toLocaleString('en-IN')} is above the EMI-eligibility threshold (₹15,000).`);
    action = 'offer_emi';
    emiMonths = cartValue > 40000 ? 6 : 3;
    rationale = `High cart value suggests price-per-month, not price-per-item, is the real friction. EMI over ${emiMonths} months lowers the perceived commitment without discounting margin.`;
    trace.push(`Decision: offer ${emiMonths}-month EMI split instead of a discount, to protect margin.`);
  } else if (dropoffReason === 'price_hesitation') {
    trace.push('Customer paused specifically at the price step — a targeted discount is the highest-leverage lever here.');
    if (repeatCustomer && avgOrderValue > 0) {
      discountPct = cartValue > avgOrderValue ? 12 : 8;
      trace.push(`Repeat customer with AOV ₹${avgOrderValue.toLocaleString('en-IN')}: this cart is ${cartValue > avgOrderValue ? 'above' : 'at/below'} their norm, so offering ${discountPct}% is justified without over-discounting a customer who'd likely convert anyway.`);
    } else {
      discountPct = 5;
      trace.push('First-time / unknown-value customer: keep the discount conservative at 5% to test price sensitivity without giving away margin.');
    }
    action = 'offer_discount';
    rationale = `${discountPct}% targeted discount to convert price-sensitive intent.`;
    trace.push(`Decision: apply ${discountPct}% discount.`);
  } else {
    trace.push('Cart abandoned with no specific signal — lowest-cost recovery is a nudge, not an incentive.');
    action = 'send_reminder';
    rationale = 'No strong signal for price or payment friction. A reminder preserves margin; escalate to a discount only if the reminder is ignored.';
    trace.push('Decision: send a reminder with the saved cart, no discount yet.');
  }

  return {
    mode: 'rules',
    action,
    discountPct,
    emiMonths,
    rationale,
    trace,
  };
}

async function decideWithClaude(ctx) {
  const { cartValue, dropoffReason, repeatCustomer, avgOrderValue } = ctx;

  const system = `You are the decision engine inside a checkout-recovery agent for an e-commerce merchant using Razorpay.
Given a checkout drop-off event, choose exactly one recovery action and explain your reasoning step by step.
Respond ONLY with JSON, no prose, no markdown fences, matching this shape:
{
  "action": "offer_discount" | "offer_emi" | "offer_alt_payment" | "send_reminder",
  "discountPct": number,
  "emiMonths": number,
  "rationale": string,
  "trace": string[]
}
Rules of thumb: card declines need a payment-method fix, not a discount. High cart values (>₹15000) are better served by EMI than discounts, to protect margin. Price hesitation on lower carts merits a targeted, conservative discount. Unclear abandonment merits a reminder before any incentive.`;

  const userMsg = `Cart value: ₹${cartValue}
Drop-off reason: ${dropoffReason}
Repeat customer: ${repeatCustomer}
Average order value: ₹${avgOrderValue || 0}`;

  const resp = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 600,
    system,
    messages: [{ role: 'user', content: userMsg }],
  });

  const text = resp.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  const cleaned = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return { mode: 'llm', ...parsed };
}

module.exports = { decide };
