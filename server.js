require('dotenv').config();
const express = require('express');
const path = require('path');
const { decide } = require('./agent');
const { createPaymentLink, hasRealKeys } = require('./razorpay');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory demo catalog — replace with your real cart/session store.
const CUSTOMERS = {
  new: { repeatCustomer: false, avgOrderValue: 0 },
  repeat_high: { repeatCustomer: true, avgOrderValue: 22000 },
  repeat_low: { repeatCustomer: true, avgOrderValue: 4000 },
};

app.post('/api/recover', async (req, res) => {
  try {
    const { cartValue, dropoffReason, customerType, itemName } = req.body;

    if (!cartValue || !dropoffReason) {
      return res.status(400).json({ error: 'cartValue and dropoffReason are required' });
    }

    const profile = CUSTOMERS[customerType] || CUSTOMERS.new;
    const decision = await decide({
      cartValue,
      dropoffReason,
      repeatCustomer: profile.repeatCustomer,
      avgOrderValue: profile.avgOrderValue,
    });

    const discount = decision.discountPct || 0;
    const finalAmount = Math.round(cartValue * (1 - discount / 100));

    const link = await createPaymentLink({
      amount: finalAmount,
      description: `${itemName || 'Cart'} — recovered checkout (${decision.action})`,
      customerName: 'Demo Customer',
    });

    res.json({
      decision,
      finalAmount,
      originalAmount: cartValue,
      paymentLink: link,
      razorpayMode: hasRealKeys ? 'live_test_mode' : 'mock',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Agent failed to reach a decision', detail: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    llmEnabled: !!process.env.ANTHROPIC_API_KEY,
    razorpayLive: hasRealKeys,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CartSave AI running at http://localhost:${PORT}`);
  console.log(`  LLM reasoning: ${process.env.ANTHROPIC_API_KEY ? 'ENABLED (Claude)' : 'disabled — using rule engine'}`);
  console.log(`  Razorpay:      ${hasRealKeys ? 'LIVE TEST MODE' : 'MOCK (no real links)'}`);
});
