const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });

function run(command, args) {
  const line = [command, ...args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg))].join(' ');
  const result = spawnSync(line, { cwd: root, stdio: 'inherit', shell: true });
  if (result.status !== 0) process.exit(result.status || 1);
}

run('npx', [
  '--yes', 'esbuild', 'server/index.js',
  '--bundle', '--platform=node', '--target=node22',
  '--outfile=dist/server.cjs', '--external:node:sqlite',
]);

fs.writeFileSync(path.join(root, 'sea-config.json'), JSON.stringify({
  main: 'dist/server.cjs',
  output: 'dist/sea-prep.blob',
  disableExperimentalSEAWarning: true,
}, null, 2));

run(process.execPath, ['--experimental-sea-config', 'sea-config.json']);

const exe = path.join(root, 'Parcel Rack.exe');
if (fs.existsSync(exe)) fs.unlinkSync(exe);
fs.copyFileSync(process.execPath, exe);

run('npx', [
  '--yes', 'postject',
  'Parcel Rack.exe', 'NODE_SEA_BLOB', 'dist/sea-prep.blob',
  '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
]);

console.log('Built Parcel Rack.exe');
