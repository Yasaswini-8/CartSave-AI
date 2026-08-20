# CartSave AI

Agentic checkout-recovery assistant for Razorpay — **Track 1: AI Growth & Agentic Commerce**.

## What it does

When a checkout drops off (card declined, price hesitation, or silent abandonment), the agent:
1. **Perceives** the drop-off event and customer context (cart value, repeat/new, historical AOV).
2. **Reasons** step-by-step about *why* the drop-off happened and what would actually fix it — not a blanket "give everyone 10% off."
3. **Decides** one of four actions: offer a discount, offer an EMI split, surface an alternate payment method, or just send a reminder.
4. **Acts** by generating a real Razorpay Payment Link for the recovered checkout.

The reasoning trace is shown live in the UI — the whole pitch is that the agent's decision-making is auditable, not a black box.

## Stack

- **Backend**: Node.js + Express
- **Agent brain**: rule-based decision engine by default; swaps in Claude (`@anthropic-ai/sdk`) automatically if `ANTHROPIC_API_KEY` is set, with automatic fallback to rules if the API call fails
- **Payments**: `razorpay` npm SDK (test mode) if `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` are set; otherwise returns a labeled mock payment link so the demo always runs
- **Frontend**: single HTML/CSS/JS page, no build step

## How to run it

```bash
cd cartsave-ai
npm install
npm start
```

Open **http://localhost:3000**.

It works immediately with zero configuration (rule engine + mock payment links). To upgrade it:

```bash
# .env file, or export directly
ANTHROPIC_API_KEY=sk-ant-...          # enables real LLM reasoning
RAZORPAY_KEY_ID=rzp_test_...          # enables real Razorpay test-mode payment links
RAZORPAY_KEY_SECRET=...
```

Restart the server after setting these — the header badge in the UI tells you which mode is active.

## Project layout

```
cartsave-ai/
├── server.js       Express app, /api/recover and /api/health
├── agent.js         Decision engine (rules + optional Claude reasoning)
├── razorpay.js      Payment link creation (live test mode or mock)
├── public/
│   ├── index.html   Checkout simulator + agent panel
│   ├── style.css
│   └── app.js        Streams the reasoning trace, calls the API
└── package.json
```

## What to extend first (in priority order for a buildathon)

1. **Real drop-off detection, not a button.** Right now the "trigger" is manual. Wire it to real Razorpay webhooks (`payment.failed`) and a simple client-side abandonment timer (no checkout event in N seconds → fire the agent). This is the single highest-value change — it turns a demo into an actual product.
2. **A learning loop.** Log every (context → action → converted?) outcome to a small DB (SQLite is enough for a demo) and let the agent's discount sizing adjust based on what's historically converted, instead of static thresholds. This is what makes it "AI growth" rather than "if/else with a chatbot UI."
3. **Multi-turn negotiation.** Right now the agent makes one decision. A stronger agentic story: if the first offer is ignored for N minutes, the agent escalates (EMI → EMI + small discount → human handoff), and explains *why* it escalated in the trace.
4. **Outreach channel.** Push the recovery offer via WhatsApp/SMS (Razorpay + a messaging API) instead of requiring the user to stay on the page — this is what makes it feel "agentic" in front of judges, since the agent is acting outside the browser tab.
5. **A merchant-facing dashboard.** A second view showing: total drop-offs handled, revenue recovered, action mix (discount vs EMI vs reminder), and average discount given — this is the slide judges will remember, and it's mostly a `/api/history` endpoint plus a chart.
6. **Guardrails.** Cap total discount given per customer per week, and add an explicit business-rule ceiling the LLM can't override (important if you're pitching this as something Razorpay would actually deploy — "agent that can blow your margin" is a real objection to be ready for).

## Why this framing tends to score well

- It's **agentic** in the literal sense: perceive → reason → decide → act, not just an LLM wrapper around a chat box.
- The **reasoning trace is the demo** — it's the difference between "trust me, it's smart" and showing the judges exactly why EMI beat a discount for a given cart.
- It **ties directly to Razorpay's product surface** (Payment Links API), so it doesn't read as a generic AI project retrofitted onto payments.
- It **degrades gracefully** — runs with zero API keys for the demo, and the story of "here's exactly what real keys would add" is itself a good answer to "how would you productionize this?"
