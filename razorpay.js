// razorpay.js
// Wraps Razorpay's Payment Links API. If real test-mode keys are provided
// via env vars, it creates a genuine payment link. If not, it returns a
// realistic mock link so the prototype is fully runnable out of the box.

const RazorpaySDK = require('razorpay');

const hasRealKeys = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

const instance = hasRealKeys
  ? new RazorpaySDK({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  : null;

/**
 * @param {Object} opts
 * @param {number} opts.amount - final amount in INR (rupees, not paise)
 * @param {string} opts.description
 * @param {string} opts.customerName
 */
async function createPaymentLink({ amount, description, customerName }) {
  if (instance) {
    const link = await instance.paymentLink.create({
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      description,
      customer: { name: customerName || 'Customer' },
      notify: { sms: false, email: false },
    });
    return { url: link.short_url, id: link.id, mode: 'live_test_mode' };
  }

  // Mock mode — deterministic fake link, clearly labeled as such.
  const fakeId = 'plink_MOCK' + Math.random().toString(36).slice(2, 10);
  return {
    url: `https://rzp.io/l/${fakeId}`,
    id: fakeId,
    mode: 'mock',
  };
}

module.exports = { createPaymentLink, hasRealKeys };
