const LABELS = {
  ASSIGNED: 'Placing',
  STORED: 'Waiting',
  COLLECTING: 'Collecting',
  COLLECTED: 'Collected',
  CANCELLED: 'Cancelled',
};

const grid = document.querySelector('#grid');
const rows = document.querySelector('#rows');
const detail = document.querySelector('#detail');
const pill = document.querySelector('#pill');
const search = document.querySelector('#search');
const filter = document.querySelector('#filter');
let snapshot = { slots: [], parcels: [] };
let events = [];
let selected = '';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function slotLabel(n) {
  return String(n).padStart(2, '0');
}

function matchesFilter(parcel) {
  const q = search.value.trim().toLowerCase();
  const blob = [parcel.receiverName, parcel.empId, parcel.parcelId, parcel.reference, parcel.courierCompany]
    .join(' ').toLowerCase();
  if (q && !blob.includes(q)) return false;
  if (filter.value === 'placing') return parcel.status === 'ASSIGNED';
  if (filter.value === 'waiting') return parcel.status === 'STORED' || parcel.status === 'COLLECTING';
  if (filter.value === 'collected') return parcel.status === 'COLLECTED';
  if (filter.value === 'cancelled') return parcel.status === 'CANCELLED';
  return true;
}

function render() {
  const online = snapshot.online;
  pill.className = online ? 'pill online' : 'pill';
  pill.innerHTML = `<span class="dot"></span>${online ? 'Rack online' : 'Rack offline'}`;

  grid.innerHTML = (snapshot.slots || []).map((slot) => `
    <article class="card slot-card ${slot.overdue ? 'overdue' : ''}">
      <header class="hw-row"><strong>Slot ${esc(slot.slotLabel)}</strong><span class="led ${esc(slot.led)}"></span></header>
      <p>${esc(slot.status === 'EMPTY' ? 'Empty' : slot.status.toLowerCase())}</p>
      <p class="who">${esc(slot.receiverName || '')}</p>
    </article>
  `).join('');

  const list = (snapshot.parcels || []).filter(matchesFilter);
  const emptyText = (snapshot.parcels || []).length === 0 ? 'No parcels yet.' : 'No parcels match.';
  rows.innerHTML = list.length ? list.map((parcel) => `
    <tr class="clickable ${parcel.overdue ? 'overdue' : ''} ${parcel.parcelId === selected ? 'selected' : ''}" data-id="${esc(parcel.parcelId)}">
      <td>${esc(parcel.parcelId)}</td>
      <td>${esc(parcel.receiverName)}<br><small>${esc(parcel.empId)}</small></td>
      <td>${esc(slotLabel(parcel.slot))}</td>
      <td>${esc(LABELS[parcel.status] || parcel.status)}${parcel.overdue ? ' · overdue' : ''}</td>
      <td>${esc(parcel.courierCompany)}</td>
    </tr>
  `).join('') : `<tr><td colspan="5">${emptyText}</td></tr>`;

  const parcel = (snapshot.parcels || []).find((item) => item.parcelId === selected);
  if (!parcel) {
    detail.classList.add('hidden');
    return;
  }
  const story = events.filter((event) => event.parcelId === parcel.parcelId);
  detail.classList.remove('hidden');
  detail.innerHTML = `
    <p class="eyebrow">Confirm their ID, then read the code</p>
    <h2>${esc(parcel.receiverName)} · ${esc(parcel.empId)}</h2>
    <p class="code">${esc(parcel.pickupCode)}</p>
    <p class="meta">
      <span>Slot ${esc(slotLabel(parcel.slot))} · ${esc(LABELS[parcel.status] || parcel.status)}</span>
      <span>${esc(parcel.courierCompany)} ${esc(parcel.reference || '')}</span>
      <span>${esc(parcel.department || '')}</span>
    </p>
    <ol class="timeline">${story.map((event) => `<li>${esc(new Date(event.time).toLocaleTimeString([], { hour12: false }))} ${esc(event.type)} — ${esc(event.details || '')}</li>`).join('') || '<li>No events yet.</li>'}</ol>`;
}

async function loadAccess() {
  const note = document.querySelector('#access-note');
  const ip = document.querySelector('#access-ip');
  const url = document.querySelector('#access-url');
  const img = document.querySelector('#qr');
  try {
    const data = await fetch('/api/admin/access').then((res) => res.json());
    if (!data.addresses.length) {
      note.textContent = 'Connect this laptop to Parcel Rack WiFi, then reload this page. Phones cannot open a localhost address.';
      ip.textContent = '';
      url.textContent = '';
      img.classList.add('hidden');
      return;
    }
    note.textContent = 'Print or photograph this code for the rack. The ESP32 SERVER setting uses this IP and port 3000. The code uses the first address.';
    ip.textContent = data.addresses.map((item) => item.ip).join('\n');
    url.textContent = data.addresses.map((item) => item.courierUrl).join('\n');
    img.classList.remove('hidden');
    if (!img.getAttribute('src')) img.src = '/api/admin/courier-qr.svg';
  } catch {
    note.textContent = 'Cannot reach Parcel Rack.';
  }
}

async function refresh() {
  const [overviewRes, eventRes] = await Promise.all([
    fetch('/api/admin/overview'),
    fetch('/api/events?since=0'),
  ]);
  snapshot = await overviewRes.json();
  events = (await eventRes.json()).events || [];
  render();
}

rows.addEventListener('click', (event) => {
  const row = event.target.closest('tr[data-id]');
  if (!row) return;
  selected = row.dataset.id;
  render();
});
search.addEventListener('input', render);
filter.addEventListener('change', render);

document.querySelector('#demo').addEventListener('click', async () => {
  await fetch('/api/admin/demo', { method: 'POST' });
  await refresh();
});
document.querySelector('#clear').addEventListener('click', async () => {
  if (!confirm('Clear every parcel and empty the slots?')) return;
  await fetch('/api/admin/reset', { method: 'POST' });
  selected = '';
  await refresh();
});

refresh().catch(() => {
  pill.textContent = 'Rack offline';
});
loadAccess();
setInterval(() => refresh().catch(() => {}), 2000);
