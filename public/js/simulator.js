const rack = document.querySelector('#rack');
const active = document.querySelector('#active');
const msg = document.querySelector('#msg');
let timer = 0;
let built = false;

function slotLabel(n) {
  return String(n).padStart(2, '0');
}

function paint(state) {
  if (!built) {
    rack.innerHTML = state.slots.map((slot) => `
      <article class="bay">
        <header><strong>Slot ${slotLabel(slot.slot)}</strong><span class="led" data-led="${slot.slot}"></span></header>
        <button type="button" data-slot="${slot.slot}">Press button</button>
      </article>
    `).join('');
    built = true;
    rack.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-slot]');
      if (!button || !active.checked) return;
      msg.textContent = 'Sending press for slot ' + button.dataset.slot + '…';
      const res = await fetch('/api/rack/button', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot: Number(button.dataset.slot) }),
      });
      const data = await res.json();
      msg.textContent = `Slot ${button.dataset.slot}: ${data.action || data.error}`;
      tick();
    });
  }
  for (const slot of state.slots) {
    const led = rack.querySelector(`[data-led="${slot.slot}"]`);
    if (led) led.className = 'led ' + (slot.led === 'off' ? '' : slot.led);
  }
}

async function tick() {
  if (!active.checked) return;
  try {
    const state = await fetch('/api/rack/state').then((res) => res.json());
    paint(state);
  } catch {
    msg.textContent = 'Cannot reach Parcel Rack.';
  }
}

function arm() {
  clearInterval(timer);
  if (!active.checked) {
    msg.textContent = 'Simulator paused. The real ESP32 can poll without this page fighting it.';
    return;
  }
  msg.textContent = 'Polling the rack twice a second, the same way the ESP32 does.';
  tick();
  timer = setInterval(tick, 500);
}

active.addEventListener('change', arm);
arm();
