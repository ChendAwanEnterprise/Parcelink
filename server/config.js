const fs = require('fs');
const path = require('path');

function resolveRoot() {
  if (process.env.SPSR_ROOT) return path.resolve(process.env.SPSR_ROOT);
  const fromSource = path.join(__dirname, '..');
  if (fs.existsSync(path.join(fromSource, 'config.json'))) return fromSource;
  const fromExe = path.dirname(process.execPath);
  if (fs.existsSync(path.join(fromExe, 'config.json'))) return fromExe;
  return fromSource;
}

function loadConfig(root) {
  const file = process.env.SPSR_CONFIG
    ? path.resolve(process.env.SPSR_CONFIG)
    : path.join(root, 'config.json');
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (process.env.SPSR_PORT) config.port = Number(process.env.SPSR_PORT);
  config.slots = Number(config.slots) || 4;
  config.timeouts = {
    placeMs: 300000,
    maxAttempts: 3,
    lockMs: 300000,
    blinkMs: 120000,
    offlineMs: 5000,
    overdueMs: 259200000,
    ...(config.timeouts || {}),
  };
  return config;
}

module.exports = { resolveRoot, loadConfig };
