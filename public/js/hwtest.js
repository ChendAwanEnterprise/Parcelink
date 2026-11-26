const pill = document.querySelector('#pill');
const log = document.querySelector('#log');
const slotsEl = document.querySelector('#slots');
const testMode = document.querySelector('#testmode');
let since = 0;
let slotNumbers = [];
let lastSeen = null;
let online = false;
let built = false;

function clock(iso) {
  return new Date(iso).toLocaleTimeString([], { hour12: false });
}

function paintPill() {
  if (!online) {
    pill.className = 'pill';
    pill.textContent = 'ESP32 offline';
    return;
  }
  const age = lastSeen ? ((Date.now() - lastSeen) / 1000).toFixed(1) : '0.0';
  pill.className = 'pill online';
  pill.textContent = `ESP32 online, last seen ${age} s ago`;
}

async function setLed(slot, led) {
  await fetch(`/api/admin/slot/${slot}/led`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ led }),
  });
}

async function build(overview) {
  if (built) return;
  slotNumbers = overview.slots.map((slot) => slot.slot);
  slotsEl.innerHTML = overview.slots.map((slot) => `
    <div class="hw-row">
      <strong>Slot ${slot.slotLabel}</strong>
      <span class="led ${slot.led === 'off' ? '' : slot.led}" data-led="${slot.slot}"></span>
      <span class="actions">
        <button type="button" data-slot="${slot.slot}" data-led="on">On</button>
        <button type="button" class="secondary" data-slot="${slot.slot}" data-led="off">Off</button>
        <button type="button" class="secondary" data-slot="${slot.slot}" data-led="blink">Blink</button>
      </span>
    </div>
  `).join('');
  built = true;
}

function paintLeds(overview) {
  for (const slot of overview.slots) {
    const led = slotsEl.querySelector(`[data-led="${slot.slot}"]`);
    if (led) led.className = 'led ' + (slot.led === 'off' ? '' : slot.led);
  }
}

async function refresh() {
  const status = await fetch('/api/rack/status').then((res) => res.json());
  online = status.online;
  lastSeen = status.lastSeen;
  if (!built) testMode.checked = status.testMode;
  const overview = await fetch('/api/admin/overview').then((res) => res.json());
  await build(overview);
  paintLeds(overview);
  const data = await fetch('/api/events?since=' + since).then((res) => res.json());
  for (const event of data.events) {
    since = event.id;
    if (event.type !== 'BUTTON') continue;
    if (log.textContent.startsWith('Waiting')) log.textContent = '';
    log.textContent += `${clock(event.time)} ${event.details}\n`;
    log.scrollTop = log.scrollHeight;
  }
  paintPill();
}

slotsEl.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-led]');
  if (!button) return;
  await setLed(button.dataset.slot, button.dataset.led);
  refresh();
});

document.querySelectorAll('[data-all]').forEach((button) => {
  button.addEventListener('click', async () => {
    for (const slot of slotNumbers) await setLed(slot, button.dataset.all);
    refresh();
  });
});

testMode.addEventListener('change', async () => {
  await fetch('/api/admin/test-mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: testMode.checked }),
  });
});

refresh().catch(() => {
  pill.textContent = 'ESP32 offline';
});
setInterval(() => refresh().catch(() => {}), 1000);
setInterval(paintPill, 200);
