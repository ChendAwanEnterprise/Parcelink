const card = document.querySelector('#card');
const parcelId = decodeURIComponent(location.pathname.split('/').pop());

function slotLabel(n) {
  return String(n).padStart(2, '0');
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

async function refresh() {
  const res = await fetch('/api/parcels/' + encodeURIComponent(parcelId));
  const data = await res.json();
  if (!res.ok) {
    card.innerHTML = '<p class="banner bad">Parcel not found.</p>';
    return;
  }
  if (data.status === 'CANCELLED') {
    card.innerHTML = `
      <p class="eyebrow">Drop-off expired</p>
      <h1>Slot released</h1>
      <p>The button was not pressed in time. Submit the parcel again.</p>`;
    return;
  }
  if (data.status === 'STORED' || data.status === 'COLLECTING' || data.status === 'COLLECTED') {
    card.innerHTML = `
      <p class="eyebrow">Delivery successful</p>
      <h1>Stored</h1>
      <p class="meta">
        <span>Slot ${esc(slotLabel(data.slot))}</span>
        <span>${esc(data.receiverName)}</span>
        <span>${esc(data.parcelId)}</span>
        <span>Pickup code ${esc(data.pickupCode)}</span>
      </p>`;
    return;
  }
  card.innerHTML = `
    <p class="eyebrow">Place the parcel</p>
    <p class="slot-hero">SLOT ${esc(slotLabel(data.slot))}</p>
    <p>Put the parcel in the slot with the steady green light, then press that slot's button.</p>
    <p class="meta">
      <span>Receiver ${esc(data.receiverName)} (${esc(data.empId)})</span>
      <span>Parcel ${esc(data.parcelId)}</span>
    </p>
    <p class="eyebrow">Pickup code</p>
    <p class="code">${esc(data.pickupCode)}</p>`;
}

refresh().catch(() => {
  card.innerHTML = '<p class="banner bad">Cannot reach Parcel Rack.</p>';
});
setInterval(() => refresh().catch(() => {}), 2000);
