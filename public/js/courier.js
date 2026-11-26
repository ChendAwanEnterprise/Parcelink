const emp = document.querySelector('#emp');
const suggest = document.querySelector('#suggest');
const picked = document.querySelector('#picked');
const error = document.querySelector('#error');
const offline = document.querySelector('#offline');
const submit = document.querySelector('#submit');
const form = document.querySelector('#form');

function showError(text) {
  error.textContent = text || '';
  error.classList.toggle('hidden', !text);
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function suggestionButtons(people) {
  return people.map((person) =>
    `<button type="button" data-id="${esc(person.empId)}" data-name="${esc(person.name)}">${esc(person.empId)} · ${esc(person.name)} <small>${esc(person.department || '')}</small></button>`
  ).join('');
}

async function refreshStatus() {
  try {
    const data = await fetch('/api/rack/status').then((res) => res.json());
    offline.classList.toggle('hidden', data.online);
    submit.disabled = !data.online;
  } catch {
    offline.classList.remove('hidden');
    offline.textContent = 'Cannot reach Parcel Rack. Start it from the desktop icon, then reload this page.';
    submit.disabled = true;
  }
}

let suggestTimer = 0;
emp.addEventListener('input', () => {
  picked.textContent = '';
  clearTimeout(suggestTimer);
  suggestTimer = setTimeout(loadSuggestions, 150);
});

async function loadSuggestions() {
  const q = emp.value.trim();
  if (q.length < 1) {
    suggest.classList.add('hidden');
    suggest.innerHTML = '';
    return;
  }
  const data = await fetch('/api/employees?q=' + encodeURIComponent(q)).then((res) => res.json());
  if (!data.employees.length) {
    suggest.classList.add('hidden');
    suggest.innerHTML = '';
    return;
  }
  suggest.innerHTML = suggestionButtons(data.employees);
  suggest.classList.remove('hidden');
}

suggest.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  emp.value = button.dataset.id;
  picked.textContent = button.dataset.name;
  suggest.classList.add('hidden');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError('');
  submit.disabled = true;
  try {
    const res = await fetch('/api/parcels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        empId: emp.value,
        courierCompany: document.querySelector('#company').value,
        reference: document.querySelector('#reference').value,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error || 'Could not assign a slot');
      if (data.suggestions && data.suggestions.length) {
        suggest.innerHTML = suggestionButtons(data.suggestions);
        suggest.classList.remove('hidden');
      }
      submit.disabled = false;
      return;
    }
    location.href = '/courier/done/' + encodeURIComponent(data.parcelId);
  } catch {
    showError('Cannot reach Parcel Rack.');
    submit.disabled = false;
  }
});

refreshStatus();
setInterval(refreshStatus, 2000);
