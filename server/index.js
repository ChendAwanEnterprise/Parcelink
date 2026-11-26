const path = require('path');
const { exec } = require('child_process');
const { resolveRoot, loadConfig } = require('./config');
const { openDatabase } = require('./db');
const { createApp } = require('./app');

function main() {
  const root = resolveRoot();
  const config = loadConfig(root);
  const dbPath = process.env.SPSR_DB
    ? path.resolve(process.env.SPSR_DB)
    : path.join(root, 'data', 'spsr.db');
  const db = openDatabase(dbPath, config.slots);
  const { app } = createApp({ root, config, db });

  const server = app.listen(config.port, '0.0.0.0', () => {
    const url = `http://localhost:${config.port}/admin`;
    console.log(`Parcel Rack listening on ${url}`);
    if (process.env.SPSR_OPEN !== '0') {
      exec(`cmd /c start "" "${url}"`);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${config.port} is already in use. Close the other Parcel Rack window and try again.`);
    } else {
      console.error(err);
    }
    process.exit(1);
  });

  function shutdown() {
    server.close(() => {
      try { db.close(); } catch { /* already closed */ }
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 1000).unref();
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) main();

module.exports = { main };
