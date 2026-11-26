import { explain, registerWorker, showBanner } from './common.js';
import { collection, db, doc, getDocs, setDoc } from './store.js';

const form = document.querySelector('#form');
const done = document.querySelector('#done');
const error = document.querySelector('#error');
const submit = form.querySelector('button');

registerWorker().catch(() => {});

function nextId(docs) {
  let max = 0;
  for (const item of docs) {
    const match = /^EMP(\d+)$/.exec(item.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  const number = max + 1;
  if (number > 999) throw new Error('No staff IDs are left.');
  return `EMP${String(number).padStart(3, '0')}`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showBanner(error, '');
  const name = form.name.value.trim();
  const department = form.department.value.trim();
  if (!name || !department) {
    showBanner(error, 'Enter your name and department.', 'bad');
    return;
  }
  submit.disabled = true;
  try {
    const existing = await getDocs(collection(db, 'employees'));
    const empId = nextId(existing.docs);
    await setDoc(doc(db, 'employees', empId), {
      empId,
      name: name.slice(0, 79),
      department: department.slice(0, 79),
    });
    localStorage.setItem('parcelink.empId', empId);
    document.querySelector('#new-id').textContent = empId;
    document.querySelector('#new-who').textContent = `${name} · ${department}`;
    form.classList.add('hidden');
    done.classList.remove('hidden');
  } catch (err) {
    showBanner(error, explain(err), 'bad');
    submit.disabled = false;
  }
});
