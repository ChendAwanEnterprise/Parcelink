const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const EMPLOYEES = [
  ['EMP001', 'Farah', 'Reception', 'farah@company.com'],
  ['EMP002', 'Daniel', 'Operations', 'daniel@company.com'],
  ['EMP003', 'Aina', 'Finance', 'aina@company.com'],
  ['EMP004', 'Hafiz', 'IT', 'hafiz@company.com'],
  ['EMP005', 'Mei Ling', 'HR', 'meiling@company.com'],
  ['EMP006', 'Arif', 'Sales', 'arif@company.com'],
  ['EMP007', 'Sofia', 'Marketing', 'sofia@company.com'],
  ['EMP008', 'Johan', 'Warehouse', 'johan@company.com'],
  ['EMP009', 'Nurul', 'Admin', 'nurul@company.com'],
  ['EMP010', 'Chris', 'Engineering', 'chris@company.com'],
];

function openDatabase(dbPath, slotCount) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const existed = fs.existsSync(dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 3000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      emp_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      email TEXT
    );

    CREATE TABLE IF NOT EXISTS parcels (
      parcel_id TEXT PRIMARY KEY,
      emp_id TEXT NOT NULL REFERENCES employees(emp_id),
      courier_company TEXT NOT NULL,
      reference TEXT,
      slot_no INTEGER,
      pickup_code TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      stored_at TEXT,
      collected_at TEXT,
      collecting_at TEXT,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT
    );

    CREATE TABLE IF NOT EXISTS slots (
      slot_no INTEGER PRIMARY KEY,
      status TEXT NOT NULL,
      led TEXT NOT NULL,
      parcel_id TEXT REFERENCES parcels(parcel_id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time TEXT NOT NULL,
      type TEXT NOT NULL,
      slot_no INTEGER,
      parcel_id TEXT,
      details TEXT
    );
  `);

  const employees = db.prepare('SELECT COUNT(*) AS c FROM employees').get().c;
  if (!existed || employees === 0) {
    seed(db, slotCount);
  } else {
    ensureSlots(db, slotCount);
  }
  return db;
}

function seed(db, slotCount) {
  const insertEmp = db.prepare(
    'INSERT OR IGNORE INTO employees (emp_id, name, department, email) VALUES (?, ?, ?, ?)'
  );
  db.exec('BEGIN');
  try {
    for (const row of EMPLOYEES) insertEmp.run(...row);
    ensureSlots(db, slotCount);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function ensureSlots(db, slotCount) {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO slots (slot_no, status, led, parcel_id) VALUES (?, 'EMPTY', 'off', NULL)"
  );
  for (let n = 1; n <= slotCount; n += 1) insert.run(n);
}

module.exports = { openDatabase, EMPLOYEES };
