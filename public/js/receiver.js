const form = document.querySelector('#form');
const emp = document.querySelector('#emp');
const suggest = document.querySelector('#suggest');
const banner = document.querySelector('#banner');
const results = document.querySelector('#results');
let currentId = '';

function slotLabel(n) {
  return String(n).padStart(2, '0');
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

emp.addEventListener('input', async () => {
  const q = emp.value.trim();
  if (q.length < 1) {
    suggest.classList.add('hidden');
    return;
  }
  const data = await fetch('/api/employees?q=' + encodeURIComponent(q)).then((res) => res.json());
  if (!data.employees.length) {
    suggest.classList.add('hidden');
    return;
  }
  suggest.innerHTML = data.employees.map((person) =>
    `<button type="button" data-id="${esc(person.empId)}">${esc(person.empId)} · ${esc(person.name)}</button>`
  ).join('');
  suggest.classList.remove('hidden');
});

suggest.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  emp.value = button.dataset.id;
  suggest.classList.add('hidden');
});

async function load(empId) {
  const res = await fetch('/api/receiver/' + encodeURIComponent(empId));
  const data = await res.json();
  if (!res.ok) {
    banner.className = 'banner bad';
    banner.textContent = data.error || 'Employee not found';
    banner.classList.remove('hidden');
    results.innerHTML = '';
    return;
  }
  if (!data.parcels.length) {
    banner.className = 'banner';
    banner.textContent = `${data.employee.name} has no parcel waiting.`;
    banner.classList.remove('hidden');
    results.innerHTML = '';
    return;
  }
  const lines = data.parcels.map((parcel) =>
    `Your parcel is in Slot ${slotLabel(parcel.slot)}, code ${parcel.pickupCode}`
  );
  banner.className = 'banner good';
  banner.textContent = lines.join(' ');
  banner.classList.remove('hidden');
  results.innerHTML = data.parcels.map((parcel) => `
    <article class="card">
      <p class="eyebrow">${esc(parcel.courierCompany)}</p>
      <p class="slot-hero">SLOT ${esc(slotLabel(parcel.slot))}</p>
      <p class="code">${esc(parcel.pickupCode)}</p>
      <p class="meta"><span>${esc(parcel.parcelId)}</span><span>${esc(parcel.reference || '')}</span></p>
      <a class="btn" href="/collect">Collect this parcel</a>
    </article>
  `).join('');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  currentId = emp.value.trim();
  load(currentId);
});

setInterval(() => {
  if (currentId) load(currentId).catch(() => {});
}, 2000);
