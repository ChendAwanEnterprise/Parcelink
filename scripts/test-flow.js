const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dbPath = path.join(root, 'data', 'test-spsr.db');
const config = JSON.parse(fs.readFileSync(path.join(root, 'config.test.json'), 'utf8'));
const base = `http://127.0.0.1:${config.port}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function removeDb() {
  for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

let child = null;
let serverLog = '';

function startServer() {
  serverLog = '';
  child = spawn(process.execPath, ['--experimental-sqlite', 'server/index.js'], {
    cwd: root,
    env: {
      ...process.env,
      SPSR_CONFIG: path.join(root, 'config.test.json'),
      SPSR_DB: dbPath,
      SPSR_OPEN: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const take = (chunk) => {
    serverLog = (serverLog + chunk.toString()).slice(-5000);
  };
  child.stdout.on('data', take);
  child.stderr.on('data', take);
}

async function waitUp() {
  for (let i = 0; i < 80; i += 1) {
    if (child.exitCode != null) throw new Error('Server exited early\n' + serverLog);
    try {
      const res = await fetch(base + '/api/rack/status');
      if (res.ok) return;
    } catch { /* not up yet */ }
    await sleep(100);
  }
  throw new Error('Server did not start\n' + serverLog);
}

async function stopServer() {
  if (!child || child.exitCode != null) return;
  child.kill();
  await new Promise((resolve) => child.once('exit', resolve));
  await sleep(400);
}

async function req(method, url, body) {
  const res = await fetch(base + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json, text };
}

async function online() {
  const res = await req('GET', '/api/rack/state');
  assert(res.status === 200, 'rack state failed');
  return res.json;
}

async function reset() {
  const res = await req('POST', '/api/admin/reset');
  assert(res.status === 200, 'reset failed');
}

async function drop(empId, reference) {
  await online();
  return req('POST', '/api/parcels', {
    empId,
    courierCompany: 'J&T Express',
    reference,
  });
}

function slotLed(state, n) {
  return state.slots.find((slot) => slot.slot === n).led;
}

async function main() {
  removeDb();
  startServer();
  await waitUp();

  const state = await online();
  assert(state.slots.length === 4, 'expected 4 slots');
  assert(JSON.stringify(Object.keys(state.slots[0]).sort()) === '["led","slot"]', 'frozen state shape');
  console.log('PASS frozen GET /api/rack/state');

  await req('POST', '/api/admin/demo');
  const created = await drop('EMP003', 'JT123456');
  assert(created.status === 201, 'T1 create ' + JSON.stringify(created.json));
  assert(created.json.slot === 2, 'T1 slot ' + created.json.slot);
  assert(/^\d{4}$/.test(created.json.pickupCode), 'T1 code');
  assert(created.json.receiverName === 'Aina', 'T1 receiver');
  let rack = await online();
  assert(slotLed(rack, 2) === 'on', 'T1 LED on');
  console.log('PASS T1');

  const code = created.json.pickupCode;
  const parcelId = created.json.parcelId;
  const pressed = await req('POST', '/api/rack/button', { slot: 2 });
  assert(pressed.json.ok === true && pressed.json.action === 'STORED', 'T2 action ' + JSON.stringify(pressed.json));
  const stored = await req('GET', '/api/parcels/' + parcelId);
  assert(stored.json.status === 'STORED', 'T2 status');
  rack = await online();
  assert(slotLed(rack, 2) === 'off', 'T2 LED off');
  const receiver = await req('GET', '/api/receiver/EMP003');
  assert(receiver.status === 200, 'T2 receiver');
  assert(receiver.json.parcels.some((parcel) => parcel.slot === 2 && parcel.pickupCode === code), 'T2 notification');
  console.log('PASS T2');

  const collect = await req('POST', '/api/collect', { empId: 'EMP003', code });
  assert(collect.status === 200, 'T3 ' + JSON.stringify(collect.json));
  assert(collect.json.message.includes('SLOT 02'), 'T3 message ' + collect.json.message);
  rack = await online();
  assert(slotLed(rack, 2) === 'blink', 'T3 blink');
  console.log('PASS T3');

  const taken = await req('POST', '/api/rack/button', { slot: 2 });
  assert(taken.json.action === 'COLLECTED', 'T4 action');
  const overview = await req('GET', '/api/admin/overview');
  const slot2 = overview.json.slots.find((slot) => slot.slot === 2);
  assert(slot2.status === 'EMPTY', 'T4 empty');
  const done = await req('GET', '/api/parcels/' + parcelId);
  assert(done.json.status === 'COLLECTED', 'T4 collected');
  console.log('PASS T4');

  await reset();
  await online();
  const lockDrop = await drop('EMP004', 'LOCK1');
  assert(lockDrop.status === 201, 'T5 create');
  await req('POST', '/api/rack/button', { slot: lockDrop.json.slot });
  const wrong = lockDrop.json.pickupCode === '0000' ? '1111' : '0000';
  const first = await req('POST', '/api/collect', { empId: 'EMP004', code: wrong });
  const second = await req('POST', '/api/collect', { empId: 'EMP004', code: wrong });
  const third = await req('POST', '/api/collect', { empId: 'EMP004', code: wrong });
  assert(first.status === 400 && /Incorrect code/.test(first.json.error), 'T5 first');
  assert(second.status === 400 && /Incorrect code/.test(second.json.error), 'T5 second');
  assert(third.status === 423 && /locked/i.test(third.json.error), 'T5 lock ' + third.json.error);
  const duringLock = await req('POST', '/api/collect', { empId: 'EMP004', code: lockDrop.json.pickupCode });
  assert(duringLock.status === 423 && /locked/i.test(duringLock.json.error), 'T5 correct code blocked');
  console.log('PASS T5');

  await reset();
  await online();
  for (let n = 1; n <= 4; n += 1) {
    const res = await drop('EMP00' + n, 'FULL' + n);
    assert(res.status === 201, 'T6 fill ' + n + ' ' + JSON.stringify(res.json));
  }
  const full = await drop('EMP005', 'FULL5');
  assert(full.status === 409 && /Rack full/.test(full.json.error), 'T6 message');
  const afterFull = await req('GET', '/api/admin/overview');
  const active = afterFull.json.parcels.filter((parcel) => parcel.status === 'ASSIGNED');
  assert(active.length === 4, 'T6 nothing extra assigned');
  console.log('PASS T6');

  const unknown = await drop('EMP999', 'NOPE');
  assert(unknown.status === 400 && unknown.json.error === 'Employee not found', 'T7 ' + JSON.stringify(unknown.json));
  assert(Array.isArray(unknown.json.suggestions), 'T7 suggestions');
  console.log('PASS T7');

  await reset();
  await online();
  const expire = await drop('EMP006', 'TIME');
  assert(expire.status === 201, 'T8 create');
  await sleep(config.timeouts.placeMs + 1500);
  const cancelled = await req('GET', '/api/parcels/' + expire.json.parcelId);
  assert(cancelled.json.status === 'CANCELLED', 'T8 status ' + cancelled.json.status);
  const expiredOverview = await req('GET', '/api/admin/overview');
  assert(expiredOverview.json.slots.every((slot) => slot.status === 'EMPTY'), 'T8 slots empty');
  console.log('PASS T8');

  const ignored = await req('POST', '/api/rack/button', { slot: 1 });
  assert(ignored.json.action === 'IGNORED', 'T9 action');
  const events = await req('GET', '/api/events?since=0');
  assert(events.json.events.some((event) => event.type === 'BUTTON' && event.slot === 1), 'T9 log');
  console.log('PASS T9');

  await reset();
  await online();
  const aging = await drop('EMP007', 'OLD');
  await req('POST', '/api/rack/button', { slot: aging.json.slot });
  await sleep(config.timeouts.overdueMs + 800);
  const aged = await req('GET', '/api/admin/overview');
  const agedParcel = aged.json.parcels.find((parcel) => parcel.parcelId === aging.json.parcelId);
  assert(agedParcel.overdue === true, 'overdue highlight');
  console.log('PASS overdue highlight');

  await reset();
  await online();
  const blinkDrop = await drop('EMP008', 'BLINK');
  await req('POST', '/api/rack/button', { slot: blinkDrop.json.slot });
  const blinked = await req('POST', '/api/collect', { empId: 'EMP008', code: blinkDrop.json.pickupCode });
  assert(blinked.status === 200, 'blink start');
  await sleep(config.timeouts.blinkMs + 1200);
  const back = await req('GET', '/api/parcels/' + blinkDrop.json.parcelId);
  assert(back.json.status === 'STORED', 'blink timeout ' + back.json.status);
  const blinkRack = await req('GET', '/api/rack/state');
  assert(slotLed(blinkRack.json, blinkDrop.json.slot) === 'off', 'blink LED off');
  console.log('PASS blink timeout');

  await reset();
  await online();
  const pair = await Promise.all([drop('EMP009', 'A'), drop('EMP010', 'B')]);
  assert(pair[0].status === 201 && pair[1].status === 201, 'concurrent create');
  assert(pair[0].json.slot !== pair[1].json.slot, 'concurrent slots differ');
  console.log('PASS concurrent assign');

  await online();
  let health = await req('GET', '/api/rack/status');
  assert(health.json.online === true, 'T10 started online');
  await sleep(config.timeouts.offlineMs + 700);
  health = await req('GET', '/api/rack/status');
  assert(health.json.online === false, 'T10 offline');
  console.log('PASS T10');

  const page = await req('GET', '/courier');
  assert(page.status === 200 && page.text.includes('Submit Delivery'), 'T11 page');
  console.log('PASS T11');

  await reset();
  await online();
  const kept = await drop('EMP003', 'KEEP');
  assert(kept.status === 201, 'T12 create');
  await stopServer();
  startServer();
  await waitUp();
  const restored = await req('GET', '/api/parcels/' + kept.json.parcelId);
  assert(restored.json.status === 'ASSIGNED', 'T12 status ' + restored.json.status);
  assert(restored.json.slot === kept.json.slot, 'T12 slot');
  console.log('PASS T12');

  const reseedCheck = await req('GET', '/api/employees?q=Aina');
  assert(reseedCheck.json.employees.some((person) => person.empId === 'EMP003'), 'employees survived restart');
  console.log('PASS restart kept the database');
}

main()
  .catch((err) => {
    console.error('FAIL', err.message);
    if (serverLog) console.error(serverLog);
    process.exitCode = 1;
  })
  .finally(async () => {
    await stopServer();
  });
