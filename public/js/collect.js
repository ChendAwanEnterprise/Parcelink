const form = document.querySelector('#form');
const error = document.querySelector('#error');
const result = document.querySelector('#result');
let watchId = '';

function slotLabel(n) {
  return String(n).padStart(2, '0');
}

function showError(text) {
  error.textContent = text || '';
  error.classList.toggle('hidden', !text);
}

async function watch() {
  if (!watchId) return;
  const res = await fetch('/api/parcels/' + encodeURIComponent(watchId));
  const data = await res.json();
  if (!res.ok) return;
  if (data.status === 'COLLECTED') {
    result.classList.remove('hidden');
    result.innerHTML = `
      <p class="eyebrow">Done</p>
      <h1>Parcel collected</h1>
      <p>The light is off and slot ${slotLabel(data.slot)} is empty.</p>`;
    return;
  }
  if (data.status === 'STORED') {
    result.classList.remove('hidden');
    result.innerHTML = `
      <p class="eyebrow">Light went off</p>
      <h1>Still in slot ${slotLabel(data.slot)}</h1>
      <p>The blink timed out. Enter the code again when you are at the rack.</p>`;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError('');
  const res = await fetch('/api/collect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      empId: document.querySelector('#emp').value,
      code: document.querySelector('#code').value,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    showError(data.error || 'Could not verify that code');
    result.classList.add('hidden');
    watchId = '';
    return;
  }
  watchId = data.parcelId;
  result.classList.remove('hidden');
  result.innerHTML = `
    <p class="eyebrow">Take the parcel and press the button</p>
    <p class="slot-hero">${data.message}</p>`;
});

setInterval(() => watch().catch(() => {}), 2000);
