const scenarioButtons = document.querySelectorAll('.scenario-btn');
const runBtn = document.getElementById('runAgent');
const traceLog = document.getElementById('traceLog');
const liveDot = document.getElementById('liveDot');
const outcomeCard = document.getElementById('outcomeCard');
const modeMeta = document.getElementById('modeMeta');

let selectedReason = null;

scenarioButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    scenarioButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedReason = btn.dataset.reason;
  });
});

fetch('/api/health')
  .then((r) => r.json())
  .then((h) => {
    modeMeta.textContent = `${h.llmEnabled ? 'Claude reasoning' : 'rule engine'} · ${h.razorpayLive ? 'live test mode' : 'mock payment links'}`;
  })
  .catch(() => {
    modeMeta.textContent = 'agent offline';
  });

function appendTraceLine(text, delay) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'trace-line';
      el.textContent = text;
      traceLog.appendChild(el);
      traceLog.scrollTop = traceLog.scrollHeight;
      resolve();
    }, delay);
  });
}

const ACTION_LABELS = {
  offer_discount: '→ Action: Apply targeted discount',
  offer_emi: '→ Action: Offer EMI split',
  offer_alt_payment: '→ Action: Surface alternate payment method',
  send_reminder: '→ Action: Send cart reminder (no incentive)',
};

runBtn.addEventListener('click', async () => {
  if (!selectedReason) {
    alert('Pick a drop-off scenario first.');
    return;
  }

  runBtn.disabled = true;
  liveDot.classList.add('on');
  outcomeCard.hidden = true;
  traceLog.innerHTML = '';

  const cartValue = Number(document.getElementById('cartValue').value);
  const customerType = document.getElementById('customerType').value;
  const itemName = document.getElementById('itemName').textContent;

  await appendTraceLine('Agent activated — analyzing checkout drop-off…', 100);

  try {
    const res = await fetch('/api/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cartValue, dropoffReason: selectedReason, customerType, itemName }),
    });
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    for (const line of data.decision.trace) {
      await appendTraceLine(line, 500);
    }
    await appendTraceLine(ACTION_LABELS[data.decision.action] || '→ Action: decided', 400);

    document.getElementById('outcomeAction').textContent = data.decision.rationale;
    document.getElementById('amountOriginal').textContent = `₹${data.originalAmount.toLocaleString('en-IN')}`;
    document.getElementById('amountFinal').textContent = `₹${data.finalAmount.toLocaleString('en-IN')}`;
    document.getElementById('payLink').href = data.paymentLink.url;
    document.getElementById('linkMode').textContent =
      data.razorpayMode === 'mock'
        ? 'mock link — add RAZORPAY_KEY_ID/SECRET for a real one'
        : 'live Razorpay test-mode link';
    outcomeCard.hidden = false;
  } catch (err) {
    await appendTraceLine(`Error: ${err.message}`, 200);
  } finally {
    liveDot.classList.remove('on');
    runBtn.disabled = false;
  }
});
