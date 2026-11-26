function createRack(db, config) {
  let lastSeenAt = null;
  let testMode = false;

  function nowIso() {
    return new Date().toISOString();
  }

  function padSlot(n) {
    return String(n).padStart(2, '0');
  }

  function log(type, slotNo, parcelId, details) {
    db.prepare(
      'INSERT INTO events (time, type, slot_no, parcel_id, details) VALUES (?, ?, ?, ?, ?)'
    ).run(nowIso(), type, slotNo ?? null, parcelId ?? null, details ?? null);
  }

  function isOnline() {
    if (!lastSeenAt) return false;
    return Date.now() - lastSeenAt <= config.timeouts.offlineMs;
  }

  function touchSeen() {
    lastSeenAt = Date.now();
  }

  function lockText(ms) {
    if (ms === 300000) return '5 minutes';
    if (ms % 60000 === 0) {
      const minutes = ms / 60000;
      return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    }
    const seconds = Math.max(1, Math.round(ms / 1000));
    return `${seconds} seconds`;
  }

  function suggest(query) {
    const q = String(query || '').trim().slice(0, 80).replace(/[%_]/g, '');
    if (!q) {
      return db.prepare(
        'SELECT emp_id, name, department FROM employees ORDER BY name LIMIT 10'
      ).all();
    }
    const like = `%${q}%`;
    return db.prepare(
      `SELECT emp_id, name, department FROM employees
       WHERE emp_id LIKE ? OR name LIKE ?
       ORDER BY name LIMIT 6`
    ).all(like, like);
  }

  function publicEmployee(row) {
    if (!row) return null;
    return { empId: row.emp_id, name: row.name, department: row.department };
  }

  function sweep() {
    const now = Date.now();
    const assigned = db.prepare(
      "SELECT * FROM parcels WHERE status = 'ASSIGNED'"
    ).all();
    for (const parcel of assigned) {
      if (now - Date.parse(parcel.created_at) >= config.timeouts.placeMs) {
        db.prepare(
          "UPDATE parcels SET status = 'CANCELLED' WHERE parcel_id = ?"
        ).run(parcel.parcel_id);
        db.prepare(
          "UPDATE slots SET status = 'EMPTY', led = 'off', parcel_id = NULL WHERE slot_no = ?"
        ).run(parcel.slot_no);
        log('TIMEOUT', parcel.slot_no, parcel.parcel_id, 'Place timeout. Parcel cancelled, slot released.');
      }
    }

    const collecting = db.prepare(
      "SELECT * FROM parcels WHERE status = 'COLLECTING'"
    ).all();
    for (const parcel of collecting) {
      const started = Date.parse(parcel.collecting_at || parcel.created_at);
      if (now - started >= config.timeouts.blinkMs) {
        db.prepare(
          "UPDATE parcels SET status = 'STORED', collecting_at = NULL WHERE parcel_id = ?"
        ).run(parcel.parcel_id);
        db.prepare(
          "UPDATE slots SET status = 'OCCUPIED', led = 'off' WHERE slot_no = ?"
        ).run(parcel.slot_no);
        log('TIMEOUT', parcel.slot_no, parcel.parcel_id, 'Collect timeout. Slot light off. Staff can retry.');
      }
    }

    const locked = db.prepare(
      'SELECT parcel_id, locked_until FROM parcels WHERE locked_until IS NOT NULL'
    ).all();
    for (const parcel of locked) {
      if (Date.parse(parcel.locked_until) <= now) {
        db.prepare(
          'UPDATE parcels SET locked_until = NULL, failed_attempts = 0 WHERE parcel_id = ?'
        ).run(parcel.parcel_id);
      }
    }
  }

  function nextParcelId() {
    const row = db.prepare(
      'SELECT parcel_id FROM parcels ORDER BY CAST(SUBSTR(parcel_id, 3) AS INTEGER) DESC LIMIT 1'
    ).get();
    const n = row ? parseInt(row.parcel_id.slice(2), 10) + 1 : 1001;
    return `P-${n}`;
  }

  function makeCode() {
    for (let i = 0; i < 30; i += 1) {
      const code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      const taken = db.prepare(
        `SELECT 1 AS x FROM parcels
         WHERE pickup_code = ? AND status IN ('ASSIGNED', 'STORED', 'COLLECTING')`
      ).get(code);
      if (!taken) return code;
    }
    return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  }

  function rackState() {
    touchSeen();
    sweep();
    const slots = db.prepare(
      'SELECT slot_no, led FROM slots ORDER BY slot_no'
    ).all();
    return {
      slots: slots.map((slot) => ({ slot: slot.slot_no, led: slot.led })),
    };
  }

  function status() {
    sweep();
    return {
      online: isOnline(),
      lastSeen: lastSeenAt,
      slots: config.slots,
      testMode,
    };
  }

  function createParcel({ empId, courierCompany, reference }) {
    sweep();
    const id = String(empId || '').trim().toUpperCase();
    const company = String(courierCompany || '').trim().slice(0, 80);
    const ref = String(reference || '').trim().slice(0, 80);
    if (!id) return { status: 400, error: 'Enter an Employee ID' };
    if (!company) return { status: 400, error: 'Enter the courier company' };

    const employee = db.prepare('SELECT * FROM employees WHERE emp_id = ?').get(id);
    if (!employee) {
      return {
        status: 400,
        error: 'Employee not found',
        suggestions: suggest(id).map(publicEmployee),
      };
    }
    if (!isOnline()) {
      return {
        status: 409,
        error: 'Rack offline. Wait until the rack is online before assigning a slot.',
        code: 'OFFLINE',
      };
    }

    db.exec('BEGIN IMMEDIATE');
    try {
      const slot = db.prepare(
        "SELECT slot_no FROM slots WHERE status = 'EMPTY' ORDER BY slot_no LIMIT 1"
      ).get();
      if (!slot) {
        db.exec('COMMIT');
        return {
          status: 409,
          error: 'Rack full, please hand parcel to reception',
        };
      }
      const parcelId = nextParcelId();
      const pickupCode = makeCode();
      const created = nowIso();
      db.prepare(
        `INSERT INTO parcels (
          parcel_id, emp_id, courier_company, reference, slot_no, pickup_code,
          status, created_at, failed_attempts
        ) VALUES (?, ?, ?, ?, ?, ?, 'ASSIGNED', ?, 0)`
      ).run(parcelId, id, company, ref || null, slot.slot_no, pickupCode, created);
      db.prepare(
        "UPDATE slots SET status = 'RESERVED', led = 'on', parcel_id = ? WHERE slot_no = ?"
      ).run(parcelId, slot.slot_no);
      log('ASSIGN', slot.slot_no, parcelId, `Assigned to ${employee.name}`);
      db.exec('COMMIT');
      return {
        status: 201,
        parcelId,
        slot: slot.slot_no,
        slotLabel: padSlot(slot.slot_no),
        pickupCode,
        receiverName: employee.name,
        empId: id,
      };
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* already closed */ }
      throw err;
    }
  }

  function getParcel(parcelId) {
    sweep();
    const parcel = db.prepare(
      `SELECT p.*, e.name AS receiver_name
       FROM parcels p JOIN employees e ON e.emp_id = p.emp_id
       WHERE p.parcel_id = ?`
    ).get(parcelId);
    if (!parcel) return { status: 404, error: 'Parcel not found' };
    return { status: 200, parcel: presentParcel(parcel) };
  }

  function presentParcel(parcel) {
    return {
      parcelId: parcel.parcel_id,
      empId: parcel.emp_id,
      receiverName: parcel.receiver_name,
      courierCompany: parcel.courier_company,
      reference: parcel.reference,
      slot: parcel.slot_no,
      slotLabel: padSlot(parcel.slot_no),
      pickupCode: parcel.pickup_code,
      status: parcel.status,
      createdAt: parcel.created_at,
      storedAt: parcel.stored_at,
      collectedAt: parcel.collected_at,
      failedAttempts: parcel.failed_attempts,
      lockedUntil: parcel.locked_until,
      overdue: isOverdue(parcel),
    };
  }

  function isOverdue(parcel) {
    if (parcel.status !== 'STORED' || !parcel.stored_at) return false;
    return Date.now() - Date.parse(parcel.stored_at) > config.timeouts.overdueMs;
  }

  function receiverParcels(empId) {
    sweep();
    const id = String(empId || '').trim().toUpperCase();
    const employee = db.prepare('SELECT * FROM employees WHERE emp_id = ?').get(id);
    if (!employee) {
      return {
        status: 404,
        error: 'Employee not found',
        suggestions: suggest(id).map(publicEmployee),
      };
    }
    const rows = db.prepare(
      `SELECT p.*, e.name AS receiver_name
       FROM parcels p JOIN employees e ON e.emp_id = p.emp_id
       WHERE p.emp_id = ? AND p.status IN ('STORED', 'COLLECTING')
       ORDER BY p.stored_at DESC`
    ).all(id);
    return {
      status: 200,
      employee: publicEmployee(employee),
      parcels: rows.map(presentParcel),
    };
  }

  function collect({ empId, code }) {
    sweep();
    const id = String(empId || '').trim().toUpperCase();
    const pin = String(code ?? '').trim();
    if (!id) return { status: 400, error: 'Enter an Employee ID' };
    if (!pin) return { status: 400, error: 'Enter the pickup code' };

    const employee = db.prepare('SELECT * FROM employees WHERE emp_id = ?').get(id);
    if (!employee) {
      return {
        status: 400,
        error: 'Employee not found',
        suggestions: suggest(id).map(publicEmployee),
      };
    }

    const waiting = db.prepare(
      `SELECT * FROM parcels
       WHERE emp_id = ? AND status = 'STORED'
       ORDER BY stored_at DESC`
    ).all(id);
    if (waiting.length === 0) {
      return { status: 404, error: 'No parcel is waiting for collection' };
    }

    const now = Date.now();
    const locked = [];
    const open = [];
    for (const parcel of waiting) {
      if (parcel.locked_until && Date.parse(parcel.locked_until) > now) locked.push(parcel);
      else open.push(parcel);
    }

    const match = open.find((parcel) => parcel.pickup_code === pin);
    if (match) {
      const stamp = nowIso();
      db.prepare(
        `UPDATE parcels
         SET status = 'COLLECTING', collecting_at = ?, failed_attempts = 0, locked_until = NULL
         WHERE parcel_id = ?`
      ).run(stamp, match.parcel_id);
      db.prepare(
        "UPDATE slots SET status = 'OCCUPIED', led = 'blink' WHERE slot_no = ?"
      ).run(match.slot_no);
      log('VERIFY_OK', match.slot_no, match.parcel_id, 'Pickup code accepted');
      return {
        status: 200,
        ok: true,
        parcelId: match.parcel_id,
        slot: match.slot_no,
        slotLabel: padSlot(match.slot_no),
        message: `YOUR PARCEL IS IN SLOT ${padSlot(match.slot_no)}`,
      };
    }

    if (open.length === 0) {
      return {
        status: 423,
        error: `This parcel is locked. Try again in ${lockText(config.timeouts.lockMs)}.`,
        attemptsLeft: 0,
        lockedUntil: locked[0].locked_until,
      };
    }

    const target = open[0];
    const attempts = target.failed_attempts + 1;
    const max = config.timeouts.maxAttempts;
    if (attempts >= max) {
      const until = new Date(now + config.timeouts.lockMs).toISOString();
      db.prepare(
        'UPDATE parcels SET failed_attempts = ?, locked_until = ? WHERE parcel_id = ?'
      ).run(attempts, until, target.parcel_id);
      log('VERIFY_FAIL', target.slot_no, target.parcel_id, 'Pickup code rejected. Parcel locked.');
      return {
        status: 423,
        error: `Incorrect code. This parcel is locked for ${lockText(config.timeouts.lockMs)}.`,
        attemptsLeft: 0,
        lockedUntil: until,
      };
    }

    db.prepare('UPDATE parcels SET failed_attempts = ? WHERE parcel_id = ?').run(attempts, target.parcel_id);
    const left = max - attempts;
    log('VERIFY_FAIL', target.slot_no, target.parcel_id, `Incorrect code. ${left} attempts left.`);
    return {
      status: 400,
      error: `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.`,
      attemptsLeft: left,
    };
  }

  function pressButton(slotNo) {
    sweep();
    const slot = db.prepare('SELECT * FROM slots WHERE slot_no = ?').get(slotNo);
    if (!slot) return { status: 404, ok: false, error: 'Unknown slot' };

    log('BUTTON', slotNo, slot.parcel_id, `Button pressed on slot ${slotNo}`);
    if (testMode) return { status: 200, ok: true, action: 'IGNORED' };

    const parcel = slot.parcel_id
      ? db.prepare('SELECT * FROM parcels WHERE parcel_id = ?').get(slot.parcel_id)
      : null;

    if (slot.status === 'RESERVED' && parcel && parcel.status === 'ASSIGNED') {
      db.prepare(
        "UPDATE parcels SET status = 'STORED', stored_at = ? WHERE parcel_id = ?"
      ).run(nowIso(), parcel.parcel_id);
      db.prepare(
        "UPDATE slots SET status = 'OCCUPIED', led = 'off' WHERE slot_no = ?"
      ).run(slotNo);
      log('STORE', slotNo, parcel.parcel_id, 'Parcel stored');
      return { status: 200, ok: true, action: 'STORED' };
    }

    if (slot.status === 'OCCUPIED' && parcel && parcel.status === 'COLLECTING') {
      db.prepare(
        "UPDATE parcels SET status = 'COLLECTED', collected_at = ? WHERE parcel_id = ?"
      ).run(nowIso(), parcel.parcel_id);
      db.prepare(
        "UPDATE slots SET status = 'EMPTY', led = 'off', parcel_id = NULL WHERE slot_no = ?"
      ).run(slotNo);
      log('COLLECT', slotNo, parcel.parcel_id, 'Parcel collected');
      return { status: 200, ok: true, action: 'COLLECTED' };
    }

    return { status: 200, ok: true, action: 'IGNORED' };
  }

  function setLed(slotNo, led) {
    if (!['on', 'off', 'blink'].includes(led)) {
      return { status: 400, error: 'LED must be on, off, or blink' };
    }
    const slot = db.prepare('SELECT slot_no FROM slots WHERE slot_no = ?').get(slotNo);
    if (!slot) return { status: 404, error: 'Unknown slot' };
    db.prepare('UPDATE slots SET led = ? WHERE slot_no = ?').run(led, slotNo);
    return { status: 200, ok: true, slot: slotNo, led };
  }

  function setTestMode(enabled) {
    testMode = Boolean(enabled);
    return { testMode };
  }

  function listEvents(since) {
    const n = Number(since);
    const rows = db.prepare(
      'SELECT * FROM events WHERE id > ? ORDER BY id ASC'
    ).all(Number.isFinite(n) ? n : 0);
    return rows.map((row) => ({
      id: row.id,
      time: row.time,
      type: row.type,
      slot: row.slot_no,
      parcelId: row.parcel_id,
      details: row.details,
    }));
  }

  function overview() {
    sweep();
    const slots = db.prepare(
      `SELECT s.*, p.status AS parcel_status, p.emp_id, e.name AS receiver_name,
              p.stored_at, p.pickup_code, p.courier_company
       FROM slots s
       LEFT JOIN parcels p ON p.parcel_id = s.parcel_id
       LEFT JOIN employees e ON e.emp_id = p.emp_id
       ORDER BY s.slot_no`
    ).all();
    const parcels = db.prepare(
      `SELECT p.*, e.name AS receiver_name, e.department
       FROM parcels p JOIN employees e ON e.emp_id = p.emp_id
       ORDER BY p.created_at DESC`
    ).all();
    return {
      online: isOnline(),
      lastSeen: lastSeenAt,
      testMode,
      slots: slots.map((slot) => ({
        slot: slot.slot_no,
        slotLabel: padSlot(slot.slot_no),
        status: slot.status,
        led: slot.led,
        parcelId: slot.parcel_id,
        empId: slot.emp_id || null,
        receiverName: slot.receiver_name || null,
        parcelStatus: slot.parcel_status || null,
        overdue: slot.parcel_status === 'STORED'
          && slot.stored_at
          && Date.now() - Date.parse(slot.stored_at) > config.timeouts.overdueMs,
      })),
      parcels: parcels.map((parcel) => ({
        ...presentParcel(parcel),
        department: parcel.department,
      })),
    };
  }

  function resetRack() {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE slots SET parcel_id = NULL').run();
      db.prepare('DELETE FROM events').run();
      db.prepare('DELETE FROM parcels').run();
      db.prepare("UPDATE slots SET status = 'EMPTY', led = 'off', parcel_id = NULL").run();
      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* ignore */ }
      throw err;
    }
    return { ok: true };
  }

  function loadDemo() {
    resetRack();
    const samples = [
      { empId: 'EMP001', company: 'Pos Laju', reference: 'PL100001', slot: 1 },
      { empId: 'EMP002', company: 'DHL', reference: 'DHL200002', slot: 3 },
    ];
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const sample of samples) {
        const employee = db.prepare('SELECT * FROM employees WHERE emp_id = ?').get(sample.empId);
        const parcelId = nextParcelId();
        const code = makeCode();
        const stamp = nowIso();
        db.prepare(
          `INSERT INTO parcels (
            parcel_id, emp_id, courier_company, reference, slot_no, pickup_code,
            status, created_at, stored_at, failed_attempts
          ) VALUES (?, ?, ?, ?, ?, ?, 'STORED', ?, ?, 0)`
        ).run(parcelId, sample.empId, sample.company, sample.reference, sample.slot, code, stamp, stamp);
        db.prepare(
          "UPDATE slots SET status = 'OCCUPIED', led = 'off', parcel_id = ? WHERE slot_no = ?"
        ).run(parcelId, sample.slot);
        log('STORE', sample.slot, parcelId, `Demo parcel for ${employee.name}`);
      }
      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* ignore */ }
      throw err;
    }
    return overview();
  }

  function searchEmployees(query) {
    return suggest(query).map(publicEmployee);
  }

  return {
    rackState,
    status,
    createParcel,
    getParcel,
    receiverParcels,
    collect,
    pressButton,
    setLed,
    setTestMode,
    listEvents,
    overview,
    resetRack,
    loadDemo,
    searchEmployees,
  };
}

module.exports = { createRack };
